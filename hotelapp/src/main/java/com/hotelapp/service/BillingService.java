package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.Subscription;
import com.hotelapp.enums.SubscriptionStatus;
import com.hotelapp.repository.BusinessRepository;
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
 * Akış: işletme paneli → deneme otomatik açılır → "Aboneliği başlat" iyzico
 * hosted forma yönlendirir → iyzico callback'e token atar → doğrulanır → ACTIVE.
 *
 * enforce=false iken hiçbir şey kısıtlanmaz (mevcut/demo akış bozulmaz);
 * true olunca ilan açmak aktif deneme/abonelik ister.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final SubscriptionRepository subscriptionRepository;
    private final BusinessRepository businessRepository;
    private final IyzicoClient iyzico;

    @Value("${app.billing.enforce:false}")       private boolean enforce;
    @Value("${app.billing.trial-days:14}")        private int trialDays;
    @Value("${app.billing.monthly-price:499.00}") private BigDecimal monthlyPrice;
    @Value("${app.billing.plan:STANDARD_MONTHLY}")private String planName;
    @Value("${app.base-url:http://localhost:5173}") private String appBaseUrl;

    public record BillingStatus(SubscriptionStatus status, String plan, LocalDateTime trialEndsAt,
                                LocalDateTime currentPeriodEnd, boolean active, boolean enforced,
                                BigDecimal monthlyPrice) {}

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

        Subscription s = subscriptionRepository.findByLastCheckoutToken(token).orElse(null);
        IyzicoClient.CheckoutResult r = iyzico.retrieve(token);
        if (s == null) {
            log.warn("[BILLING] callback token eslesmedi: {}", token);
            return failUrl;
        }
        if (r.paid()) {
            s.setStatus(SubscriptionStatus.ACTIVE);
            s.setCurrentPeriodEnd(LocalDateTime.now().plusMonths(1));
            s.setLastPaymentId(r.paymentId());
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
     * İlan açma gibi işlemler için erişim kontrolü. enforce kapalıysa daima true —
     * mevcut akış ve demo bozulmaz.
     */
    @Transactional(readOnly = true)
    public boolean hasActiveAccessByBusiness(Long businessId) {
        if (!enforce) return true;
        Subscription s = subscriptionRepository.findByBusinessId(businessId).orElse(null);
        return s != null && isActive(s);
    }

    // ── iç yardımcılar ───────────────────────────────────────────────
    private Subscription getOrCreate(Long ownerId) {
        Business b = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new IllegalStateException("İşletme bulunamadı (owner=" + ownerId + ")"));
        return subscriptionRepository.findByBusinessId(b.getId()).orElseGet(() -> {
            Subscription s = Subscription.builder()
                    .business(b)
                    .status(SubscriptionStatus.TRIAL)
                    .plan(planName)
                    .trialEndsAt(LocalDateTime.now().plusDays(trialDays))
                    .build();
            return subscriptionRepository.save(s);
        });
    }

    private boolean isActive(Subscription s) {
        LocalDateTime now = LocalDateTime.now();
        if (s.getStatus() == SubscriptionStatus.TRIAL)
            return s.getTrialEndsAt() != null && s.getTrialEndsAt().isAfter(now);
        if (s.getStatus() == SubscriptionStatus.ACTIVE)
            return s.getCurrentPeriodEnd() != null && s.getCurrentPeriodEnd().isAfter(now);
        return false;
    }

    private BillingStatus toStatus(Subscription s) {
        return new BillingStatus(s.getStatus(), s.getPlan(), s.getTrialEndsAt(),
                s.getCurrentPeriodEnd(), isActive(s), enforce, monthlyPrice);
    }
}
