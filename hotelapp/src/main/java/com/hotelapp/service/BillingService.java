package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.PaymentCheckout;
import com.hotelapp.entity.Subscription;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.PaymentCheckoutStatus;
import com.hotelapp.enums.SubscriptionStatus;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.PaymentCheckoutRepository;
import com.hotelapp.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Faz 1 — İşletme aboneliği (iyzico). İşçi tarafı her zaman ücretsiz.
 *
 * MODEL (eşzamanlı aktif ilan sınırı): ücretsiz planda aynı anda en fazla
 * {free-listings} (5) ACTIVE ilan; ödenmiş abonelikte ay içinde sınırsız ilan ama
 * aynı anda en fazla {paid-concurrent-listings} (10) ACTIVE ilan. Duraklatılan
 * (PAUSED) ve kapatılan (CLOSED) ilan sayılmaz — birini duraklatınca/kapatınca yer
 * açılır. Sınır ilan oluştururken ve ilanı ACTIVE yaparken uygulanır; admin
 * moderasyonu sınırın dışındadır.
 *
 * Akış: "Aboneliği başlat" iyzico hosted forma yönlendirir (her başlatma ayrı
 * {@link PaymentCheckout} kaydı, PENDING) → iyzico callback'e token atar → token
 * bu tablodan bulunur, iyzico'dan sonuç alınır, tutar + sepet + conversationId
 * doğrulanır → ACTIVE → sınırsız ilan. Callback hiç gelmezse mutabakat işi
 * ({@link #reconcilePendingCheckouts()}) 15 dakikadan eski bekleyenleri sorgular.
 *
 * enforce=false iken hiçbir şey kısıtlanmaz (demo/dev akış bozulmaz).
 * Ödeme yapılandırılmamışsa (iyzico anahtarı yok) ücretsiz 5'lik sınır YİNE
 * uygulanır; yalnız abonelik satın alınamaz ve hata mesajı abonelik önermez.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private final SubscriptionRepository subscriptionRepository;
    private final BusinessRepository businessRepository;
    private final JobListingRepository jobListingRepository;
    private final IyzicoClient iyzico;
    private final PaymentCheckoutRepository checkoutRepository;

    /** Callback gelmemiş oturum bu kadar beklendikten sonra iyzico'ya sorulur. */
    static final Duration RECONCILE_AFTER = Duration.ofMinutes(15);
    /** Bu kadar eski ve ödenmemiş oturum EXPIRED olur. */
    static final Duration EXPIRE_AFTER = Duration.ofHours(24);
    /** Deploy öncesi Subscription.lastCheckoutToken ile başlatılmış oturum işareti. */
    static final String LEGACY_CONVERSATION = "legacy";

    @Value("${app.billing.enforce:true}")           private boolean enforce;
    @Value("${app.billing.free-listings:5}")        private int freeListings;
    @Value("${app.billing.paid-concurrent-listings:10}") private int paidConcurrentListings;
    @Value("${app.billing.trial-days:14}")          private int trialDays;
    @Value("${app.billing.monthly-price:499.00}")   private BigDecimal monthlyPrice;
    @Value("${app.billing.plan:STANDARD_MONTHLY}")  private String planName;
    @Value("${app.base-url:http://localhost:5173}") private String appBaseUrl;

    /**
     * paymentsAvailable: abonelik satın alınabilir mi (iyzico ayarlı).
     * sandbox: test ödeme ortamı — ekran test kartını yalnızca o zaman gösterir.
     */
    public record BillingStatus(SubscriptionStatus status, String plan, LocalDateTime trialEndsAt,
                                LocalDateTime currentPeriodEnd, boolean active, boolean enforced,
                                BigDecimal monthlyPrice,
                                int freeListings, long usedListings, long freeRemaining,
                                boolean paymentsAvailable, boolean sandbox,
                                int concurrentLimit, long activeListings,
                                int freeConcurrentLimit, int paidConcurrentLimit) {}

    /**
     * Eşzamanlı aktif ilan kotası anlık görüntüsü.
     * limit: bu işletmenin şu anki planındaki sınır; active: ACTIVE ilan sayısı.
     */
    public record ListingQuota(boolean enforced, boolean paid, boolean paymentsAvailable,
                               int limit, long active) {
        public boolean canActivateOneMore() {
            return !enforced || active < limit;
        }
    }

    /** Kota açıkça kapatılmadıkça (BILLING_ENFORCE=false) uygulanır — ödeme kapalıyken de. */
    private boolean enforced() {
        return enforce;
    }

    @Transactional
    public BillingStatus statusForOwner(Long ownerId) {
        Subscription s = getOrCreate(ownerId);
        return toStatus(s);
    }

    /** iyzico hosted checkout başlatır; formu render etmesi için init'i döner. */
    @Transactional
    public IyzicoClient.CheckoutInit startCheckout(Long ownerId) {
        Subscription s = getOrCreate(ownerId);
        Business b = s.getBusiness();
        String conversationId = "sub-" + b.getId() + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        IyzicoClient.CheckoutInit init = iyzico.startCheckout(
                b, b.getOwner(), monthlyPrice, planName, conversationId);
        if (init.ok() && init.token() != null && !init.token().isBlank()) {
            checkoutRepository.save(PaymentCheckout.builder()
                    .business(b)
                    .token(init.token())
                    .conversationId(conversationId)
                    .status(PaymentCheckoutStatus.PENDING)
                    .expectedPrice(monthlyPrice)
                    .build());
        }
        return init;
    }

    /**
     * iyzico callback → token'ı doğrula, başarılıysa ACTIVE yap. Frontend yönlendirme URL'i döner.
     *
     * <p>Dış transaction YOK: iyzico HTTP çağrısı (yavaş olabilir) sırasında ne DB
     * bağlantısı ne satır kilidi tutulur.
     * <ol>
     *   <li>Kilitsiz okuma: bizim oturumumuz mu, zaten sonuçlanmış mı (sonuçlanmışsa
     *       iyzico'ya hiç gidilmez).</li>
     *   <li>iyzico'dan sonuç (transaction dışında).</li>
     *   <li>Kısa transaction: satır kilidi + durum YENİDEN kontrol (bu arada mutabakat ya
     *       da tekrar gelen callback sonuçlandırdıysa hiçbir şey uygulanmaz) + uygula.</li>
     * </ol>
     */
    public String handleCallback(String token) {
        String okUrl   = appBaseUrl + "/business?tab=billing&sub=ok";
        String failUrl = appBaseUrl + "/business?tab=billing&sub=fail";
        if (token == null || token.isBlank()) return failUrl;

        // 1) Önce bizim başlattığımız bir ödeme mi? Değilse iyzico'ya hiç gitme ve
        // saldırganın gönderdiği token'ı log'a yazma.
        PaymentCheckout pc = checkoutRepository.findByToken(token).orElse(null);
        if (pc == null) {
            pc = perCheckoutTx.execute(st -> adoptLegacyCheckout(token));
            if (pc == null) {
                log.warn("[BILLING] callback token eslesmedi");
                return failUrl;
            }
        }
        String terminal = terminalUrl(pc, okUrl, failUrl);
        if (terminal != null) return terminal;

        // 2) iyzico — kilit ve DB bağlantısı tutulmadan
        IyzicoClient.CheckoutResult r = iyzico.retrieve(token);

        // 3) Kısa transaction: kilitle, durumu yeniden kontrol et, uygula
        String url = perCheckoutTx.execute(st -> {
            PaymentCheckout locked = checkoutRepository.findByTokenForUpdate(token).orElse(null);
            if (locked == null) return failUrl;
            String settled = terminalUrl(locked, okUrl, failUrl);
            if (settled != null) return settled;   // bu arada başka yol sonuçlandırdı
            if (!r.paid()) {
                // iyzico kesin sonuç döndüyse oturum kapanır; ağ hatası/zaman aşımı ise
                // PENDING kalır ve mutabakat işi tekrar dener.
                if (r.paymentStatus() != null) {
                    complete(locked, PaymentCheckoutStatus.FAILED, null);
                }
                log.warn("[BILLING] odeme basarisiz — checkout={} business={} status={}",
                        locked.getId(), locked.getBusiness().getId(), r.paymentStatus());
                return failUrl;
            }
            return settlePaid(locked, r) ? okUrl : failUrl;
        });
        return url != null ? url : failUrl;
    }

    /** Sonuçlanmış oturum için yönlendirme; PENDING ise null. Sonuçlanmış oturum için iyzico'ya gidilmez. */
    private static String terminalUrl(PaymentCheckout pc, String okUrl, String failUrl) {
        switch (pc.getStatus()) {
            case SUCCEEDED:
                // Tüketilmiş oturum tekrar geldi: idempotent, iyzico'ya gidilmez, süre uzamaz.
                log.info("[BILLING] tekrar callback yok sayildi — checkout={}", pc.getId());
                return okUrl;
            case FAILED:
            case EXPIRED:
                return failUrl;
            default:
                return null;
        }
    }

    /**
     * Mutabakat: callback'i hiç gelmemiş (tarayıcı kapandı, ağ koptu) oturumlar.
     * 15 dakikadan eski PENDING kayıtlar iyzico'ya sorulur; ödenmişse abonelik
     * uygulanır, 24 saatten eskiyse ve ödenmemişse EXPIRED olur.
     */
    @Scheduled(fixedDelayString = "${app.billing.reconcile-delay-ms:600000}",
               initialDelayString = "${app.billing.reconcile-initial-delay-ms:120000}")
    public int reconcilePendingCheckouts() {
        if (!iyzico.isConfigured()) return 0;
        LocalDateTime now = LocalDateTime.now(clock);
        List<PaymentCheckout> pending = checkoutRepository
                .findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
                        PaymentCheckoutStatus.PENDING, now.minus(RECONCILE_AFTER));
        int changed = 0;
        for (PaymentCheckout candidate : pending) {
            String token = candidate.getToken();
            try {
                if (reconcileOne(token, now)) changed++;
            } catch (RuntimeException ex) {
                log.warn("[BILLING] mutabakat basarisiz — checkout={}: {}", candidate.getId(), ex.getMessage());
            }
        }
        if (changed > 0) log.info("[BILLING] mutabakat: {} odeme oturumu sonuclandi", changed);
        return changed;
    }

    /**
     * Tek oturumun mutabakatı. true = sonuçlandı.
     * Kilitsiz güncel okuma → iyzico (transaction dışı) → kayıt başına kısa
     * REQUIRES_NEW transaction'da kilit + durum yeniden kontrol + uygula. Birinin
     * hatası yalnız kendini geri alır, diğerleri işlenir.
     */
    private boolean reconcileOne(String token, LocalDateTime now) {
        // Callback bu arada sonuçlandırdıysa iyzico'ya hiç gidilmez
        PaymentCheckout fresh = checkoutRepository.findByToken(token).orElse(null);
        if (fresh == null || fresh.getStatus() != PaymentCheckoutStatus.PENDING) return false;

        IyzicoClient.CheckoutResult r = iyzico.retrieve(token);

        Boolean done = perCheckoutTx.execute(st -> {
            // Callback ile aynı anda işlenmesin: satır kilidi + durum yeniden kontrol.
            PaymentCheckout pc = checkoutRepository.findByTokenForUpdate(token).orElse(null);
            if (pc == null || pc.getStatus() != PaymentCheckoutStatus.PENDING) return false;
            if (r.paid()) {
                settlePaid(pc, r);
                return true;
            }
            if (pc.getCreatedAt() != null && pc.getCreatedAt().isBefore(now.minus(EXPIRE_AFTER))) {
                complete(pc, PaymentCheckoutStatus.EXPIRED, null);
                return true;
            }
            return false;
        });
        return Boolean.TRUE.equals(done);
    }

    /**
     * Callback/mutabakatta kısa, kayıt başına transaction. Spring bağlamında REQUIRES_NEW
     * şablonu kurulur; bağlam dışı birim testlerinde varsayılan transaction'sız çalışır.
     */
    private org.springframework.transaction.support.TransactionOperations perCheckoutTx =
            org.springframework.transaction.support.TransactionOperations.withoutTransaction();

    @org.springframework.beans.factory.annotation.Autowired
    void setTransactionManager(org.springframework.transaction.PlatformTransactionManager txManager) {
        org.springframework.transaction.support.TransactionTemplate t =
                new org.springframework.transaction.support.TransactionTemplate(txManager);
        t.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.perCheckoutTx = t;
    }

    /**
     * Ödenmiş sonucu doğrular ve uygular. Tutar, sepet ve conversationId bizim
     * kaydımızla birebir eşleşmeli; eşleşmezse FAILED (para alınmış olabilir —
     * manuel inceleme için log; kişisel veri yazılmaz).
     */
    private boolean settlePaid(PaymentCheckout pc, IyzicoClient.CheckoutResult r) {
        Long businessId = pc.getBusiness().getId();
        String mismatch = verify(pc, r, businessId);
        if (mismatch != null) {
            complete(pc, PaymentCheckoutStatus.FAILED, r.paidPrice());
            log.error("[BILLING] odeme dogrulanamadi, abonelik uygulanmadi (manuel inceleme) — "
                    + "checkout={} business={} neden={}", pc.getId(), businessId, mismatch);
            return false;
        }

        Subscription s = subscriptionFor(pc.getBusiness());
        // Aynı ödeme ikinci kez işlenmez: süre uzamaz, iptal edilmiş abonelik
        // yeniden ACTIVE olmaz.
        if (r.paymentId() != null && r.paymentId().equals(s.getLastPaymentId())) {
            complete(pc, PaymentCheckoutStatus.SUCCEEDED, r.paidPrice());
            log.info("[BILLING] ayni odeme tekrar geldi, yok sayildi — business={}", businessId);
            return true;
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime base = (s.getCurrentPeriodEnd() != null && s.getCurrentPeriodEnd().isAfter(now))
                ? s.getCurrentPeriodEnd() : now;      // erken yenileme kalan günleri korur
        s.setStatus(SubscriptionStatus.ACTIVE);
        s.setCurrentPeriodEnd(base.plusMonths(1));
        s.setLastPaymentId(r.paymentId());
        subscriptionRepository.save(s);
        complete(pc, PaymentCheckoutStatus.SUCCEEDED, r.paidPrice());
        log.info("[BILLING] abonelik ACTIVE — business={} paymentId={}", businessId, r.paymentId());
        return true;
    }

    /** null = doğrulandı; aksi halde kısa neden (log için, kişisel veri yok). */
    private static String verify(PaymentCheckout pc, IyzicoClient.CheckoutResult r, Long businessId) {
        if (r.paidPrice() == null || pc.getExpectedPrice() == null
                || r.paidPrice().compareTo(pc.getExpectedPrice()) != 0) {
            return "tutar";
        }
        if (!IyzicoClient.basketIdFor(businessId).equals(r.basketId())) {
            return "sepet";
        }
        boolean conversationOk = LEGACY_CONVERSATION.equals(pc.getConversationId())
                ? r.conversationId() != null && r.conversationId().startsWith("sub-" + businessId + "-")
                : pc.getConversationId().equals(r.conversationId());
        return conversationOk ? null : "conversation";
    }

    private void complete(PaymentCheckout pc, PaymentCheckoutStatus status, BigDecimal paidPrice) {
        pc.setStatus(status);
        pc.setPaidPrice(paidPrice);
        pc.setCompletedAt(LocalDateTime.now(clock));
        checkoutRepository.save(pc);
    }

    /**
     * Geriye uyum: bu sürümden önce başlatılmış oturumun token'ı yalnız
     * Subscription.lastCheckoutToken'da durur. Bulunursa oturum kaydı açılır
     * (conversationId bilinmediği için önek kontrolüyle doğrulanır).
     */
    private PaymentCheckout adoptLegacyCheckout(String token) {
        Subscription legacy = subscriptionRepository.findByLastCheckoutToken(token).orElse(null);
        if (legacy == null) return null;
        legacy.setLastCheckoutToken(null);
        subscriptionRepository.save(legacy);
        return checkoutRepository.save(PaymentCheckout.builder()
                .business(legacy.getBusiness())
                .token(token)
                .conversationId(LEGACY_CONVERSATION)
                .status(PaymentCheckoutStatus.PENDING)
                .expectedPrice(monthlyPrice)
                .build());
    }

    @Transactional
    public BillingStatus cancel(Long ownerId) {
        Subscription s = getOrCreate(ownerId);
        s.setStatus(SubscriptionStatus.CANCELED);
        subscriptionRepository.save(s);
        return toStatus(s);
    }

    /** İşletmenin anlık kota durumu (ACTIVE ilan sayısı + plana göre sınır). */
    @Transactional(readOnly = true)
    public ListingQuota quotaForBusiness(Long businessId) {
        Subscription s = subscriptionRepository.findByBusinessId(businessId).orElse(null);
        boolean paid = s != null && isPaid(s);
        long active = jobListingRepository.countByBusiness_IdAndStatus(businessId, ListingStatus.ACTIVE);
        return new ListingQuota(enforced(), paid, iyzico.isConfigured(),
                paid ? paidConcurrentListings : freeListings, active);
    }

    /** Bir ilan daha ACTIVE olabilir mi (yeni ilan ya da PAUSED/CLOSED → ACTIVE)? */
    @Transactional(readOnly = true)
    public boolean canCreateListingByBusiness(Long businessId) {
        if (!enforced()) return true;
        return quotaForBusiness(businessId).canActivateOneMore();
    }

    /**
     * İlan yayınlama kapısı: bir ilan daha ACTIVE olacaksa çağrılır, sınır doluysa
     * Türkçe 422. İşletme satırı kilitlenir: aynı işletmenin eşzamanlı istekleri
     * sırayla sayılır (çağıranın transaction'ı içinde).
     */
    @Transactional
    public void requireActivationSlot(Long businessId) {
        if (!enforced()) return;
        businessRepository.lockById(businessId);
        ListingQuota q = quotaForBusiness(businessId);
        if (q.canActivateOneMore()) return;
        throw new com.hotelapp.exception.BusinessRuleException(quotaExceededMessage(q));
    }

    String quotaExceededMessage(ListingQuota q) {
        if (q.paid()) {
            return String.format("Aboneliğinle aynı anda en fazla %d aktif ilan yayınlayabilirsin "
                    + "(şu an %d aktif). Yeni ilan için bir ilanını duraklat ya da kapat.",
                    q.limit(), q.active());
        }
        if (q.paymentsAvailable()) {
            return String.format("Ücretsiz planda aynı anda en fazla %d aktif ilan yayınlayabilirsin "
                    + "(şu an %d aktif). Bir ilanını duraklat ya da kapat; daha fazlası için Abonelik "
                    + "sekmesinden aboneliğini başlat (aynı anda en fazla %d aktif ilan).",
                    q.limit(), q.active(), paidConcurrentListings);
        }
        return String.format("Ücretsiz planda aynı anda en fazla %d aktif ilan yayınlayabilirsin "
                + "(şu an %d aktif). Yeni ilan için bir ilanını duraklat ya da kapat.",
                q.limit(), q.active());
    }

    /** Ücretsiz plandaki eşzamanlı aktif ilan sınırı. */
    public int getFreeListings() { return freeListings; }

    // ── iç yardımcılar ───────────────────────────────────────────────
    private Subscription getOrCreate(Long ownerId) {
        Business b = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new IllegalStateException("İşletme bulunamadı (owner=" + ownerId + ")"));
        return subscriptionFor(b);
    }

    private Subscription subscriptionFor(Business b) {
        return subscriptionRepository.findByBusinessId(b.getId()).orElseGet(() -> {
            Subscription s = Subscription.builder()
                    .business(b)
                    .status(SubscriptionStatus.TRIAL)   // "ücretsiz plan" başlangıç durumu
                    .plan(planName)
                    .trialEndsAt(LocalDateTime.now(clock).plusDays(trialDays))
                    .build();
            return subscriptionRepository.save(s);
        });
    }

    /**
     * Gerçekten ödenmiş ve dönemi geçmemiş abonelik. İptal (CANCELED) yenilemeyi
     * durdurur; ödenmiş dönem sonuna kadar abonelik geçerli kalır.
     */
    private boolean isPaid(Subscription s) {
        return (s.getStatus() == SubscriptionStatus.ACTIVE || s.getStatus() == SubscriptionStatus.CANCELED)
                && s.getCurrentPeriodEnd() != null
                && s.getCurrentPeriodEnd().isAfter(LocalDateTime.now(clock));
    }

    /**
     * usedListings = activeListings (eşzamanlı ACTIVE ilan); freeRemaining ücretsiz
     * plandaki boş yer. concurrentLimit: şu anki plana göre sınır (ücretsiz 5 / ücretli 10).
     */
    private BillingStatus toStatus(Subscription s) {
        long active = jobListingRepository.countByBusiness_IdAndStatus(
                s.getBusiness().getId(), ListingStatus.ACTIVE);
        boolean paid = isPaid(s);
        long remaining = Math.max(0, (long) freeListings - active);
        return new BillingStatus(s.getStatus(), s.getPlan(), s.getTrialEndsAt(),
                s.getCurrentPeriodEnd(), paid, enforced(), monthlyPrice,
                freeListings, active, remaining,
                iyzico.isConfigured(), iyzico.isConfigured() && iyzico.isSandbox(),
                paid ? paidConcurrentListings : freeListings, active,
                freeListings, paidConcurrentListings);
    }
}
