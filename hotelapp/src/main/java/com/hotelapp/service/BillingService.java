package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.Subscription;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.SubscriptionStatus;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Faz 1 — İşletme aboneliği (iyzico SANDBOX). İşçi tarafı her zaman ücretsiz.
 *
 * MODEL: İlk {free-listings} ilan ücretsiz. 4. ilandan itibaren aktif (ödenmiş)
 * abonelik gerekir. Kapatılan (CLOSED) ilan kotayı boşaltır — eskisini kapatınca
 * yeni ücretsiz ilan hakkı açılır.
 *
 * Akış: "Aboneliği başlat" iyzico hosted forma yönlendirir → iyzico callback'e
 * token atar → doğrulanır → ACTIVE → sınırsız ilan.
 *
 * enforce=false iken hiçbir şey kısıtlanmaz (demo/dev akış bozulmaz).
 * Ödeme yapılandırılmamışsa (iyzico anahtarı yok) da kota uygulanmaz: ücret
 * alınamayan bir şey kısıtlanmaz — platform ücretsiz/sınırsız çalışır.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final SubscriptionRepository subscriptionRepository;
    private final BusinessRepository businessRepository;
    private final JobListingRepository jobListingRepository;
    private final IyzicoClient iyzico;

    @Value("${app.billing.enforce:true}")           private boolean enforce;
    @Value("${app.billing.free-listings:5}")        private int freeListings;
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
                                boolean paymentsAvailable, boolean sandbox) {}

    /** Kota yalnızca açıkça istenmişse VE ödeme gerçekten alınabiliyorsa uygulanır. */
    private boolean enforced() {
        return enforce && iyzico.isConfigured();
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
        IyzicoClient.CheckoutInit init = iyzico.startCheckout(
                b, b.getOwner(), monthlyPrice, planName, "sub-" + b.getId() + "-" + System.currentTimeMillis());
        if (init.ok()) {
            s.setLastCheckoutToken(init.token());
            subscriptionRepository.save(s);
        }
        return init;
    }

    /** iyzico callback → token'ı doğrula, başarılıysa ACTIVE yap. Frontend yönlendirme URL'i döner. */
    @Transactional
    public String handleCallback(String token) {
        String okUrl   = appBaseUrl + "/business?tab=billing&sub=ok";
        String failUrl = appBaseUrl + "/business?tab=billing&sub=fail";
        if (token == null || token.isBlank()) return failUrl;

        // Önce bizim başlattığımız bir ödeme mi? Değilse iyzico'ya hiç gitme ve
        // saldırganın gönderdiği token'ı log'a yazma.
        Subscription s = subscriptionRepository.findByLastCheckoutToken(token).orElse(null);
        if (s == null) {
            log.warn("[BILLING] callback token eslesmedi");
            return failUrl;
        }
        IyzicoClient.CheckoutResult r = iyzico.retrieve(token);
        if (r.paid()) {
            // Aynı ödeme ikinci kez işlenmez: süre uzamaz, iptal edilmiş abonelik
            // yeniden ACTIVE olmaz.
            if (r.paymentId() != null && r.paymentId().equals(s.getLastPaymentId())) {
                s.setLastCheckoutToken(null);
                subscriptionRepository.save(s);
                log.info("[BILLING] tekrar callback yok sayildi — business={}", s.getBusiness().getId());
                return okUrl;
            }
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime base = (s.getCurrentPeriodEnd() != null && s.getCurrentPeriodEnd().isAfter(now))
                    ? s.getCurrentPeriodEnd() : now;      // erken yenileme kalan günleri korur
            s.setStatus(SubscriptionStatus.ACTIVE);
            s.setCurrentPeriodEnd(base.plusMonths(1));
            s.setLastPaymentId(r.paymentId());
            s.setLastCheckoutToken(null);                  // token tek kullanımlık
            subscriptionRepository.save(s);
            log.info("[BILLING] abonelik ACTIVE — business={} paymentId={}", s.getBusiness().getId(), r.paymentId());
            return okUrl;
        }
        log.warn("[BILLING] odeme basarisiz — business={} status={} err={}",
                s.getBusiness().getId(), r.paymentStatus(), r.error());
        return failUrl;
    }

    @Transactional
    public BillingStatus cancel(Long ownerId) {
        Subscription s = getOrCreate(ownerId);
        s.setStatus(SubscriptionStatus.CANCELED);
        subscriptionRepository.save(s);
        return toStatus(s);
    }

    /**
     * İlan açma kapısı. enforce kapalıysa daima true (demo/dev bozulmaz).
     * Aksi halde: aktif (ödenmiş) abonelik → sınırsız; yoksa CLOSED olmayan
     * ilan sayısı ücretsiz kotanın altındaysa serbest.
     */
    @Transactional(readOnly = true)
    public boolean canCreateListingByBusiness(Long businessId) {
        if (!enforced()) return true;
        Subscription s = subscriptionRepository.findByBusinessId(businessId).orElse(null);
        if (s != null && isPaid(s)) return true;                 // abonelik → sınırsız
        long used = jobListingRepository.countByBusiness_IdAndStatusNot(businessId, ListingStatus.CLOSED);
        return used < freeListings;                              // ilk N ilan ücretsiz
    }

    /** Ücretsiz kota büyüklüğü — hata mesajı vb. için. */
    public int getFreeListings() { return freeListings; }

    // ── iç yardımcılar ───────────────────────────────────────────────
    private Subscription getOrCreate(Long ownerId) {
        Business b = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new IllegalStateException("İşletme bulunamadı (owner=" + ownerId + ")"));
        return subscriptionRepository.findByBusinessId(b.getId()).orElseGet(() -> {
            Subscription s = Subscription.builder()
                    .business(b)
                    .status(SubscriptionStatus.TRIAL)   // "ücretsiz plan" başlangıç durumu
                    .plan(planName)
                    .trialEndsAt(LocalDateTime.now().plusDays(trialDays))
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
                && s.getCurrentPeriodEnd().isAfter(LocalDateTime.now());
    }

    private BillingStatus toStatus(Subscription s) {
        long used = jobListingRepository.countByBusiness_IdAndStatusNot(
                s.getBusiness().getId(), ListingStatus.CLOSED);
        long remaining = Math.max(0, (long) freeListings - used);
        return new BillingStatus(s.getStatus(), s.getPlan(), s.getTrialEndsAt(),
                s.getCurrentPeriodEnd(), isPaid(s), enforced(), monthlyPrice,
                freeListings, used, remaining,
                iyzico.isConfigured(), iyzico.isConfigured() && iyzico.isSandbox());
    }
}
