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
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Ödeme yapılandırılmamışsa (iyzico anahtarı yok) kota uygulanmaz ve iyzico
 * çağrılmaz. Eskiden boşken sandbox anahtarlarına düşülüyordu.
 */
class BillingServiceTest {

    private SubscriptionRepository subs;
    private BusinessRepository businesses;
    private JobListingRepository listings;
    private PaymentCheckoutRepository checkouts;

    @BeforeEach
    void setUp() {
        subs = mock(SubscriptionRepository.class);
        businesses = mock(BusinessRepository.class);
        listings = mock(JobListingRepository.class);
        checkouts = mock(PaymentCheckoutRepository.class);
    }

    private BillingService service(IyzicoClient iyzico) {
        BillingService s = new BillingService(subs, businesses, listings, iyzico, checkouts);
        ReflectionTestUtils.setField(s, "enforce", true);
        ReflectionTestUtils.setField(s, "freeListings", 5);
        ReflectionTestUtils.setField(s, "trialDays", 14);
        ReflectionTestUtils.setField(s, "monthlyPrice", new BigDecimal("499.00"));
        ReflectionTestUtils.setField(s, "planName", "STANDARD_MONTHLY");
        ReflectionTestUtils.setField(s, "appBaseUrl", "http://localhost:5173");
        return s;
    }

    private static IyzicoClient client(String key, String secret, String baseUrl) {
        return new IyzicoClient(key, secret, baseUrl, "https://api.kadrom.me/api/billing/callback");
    }

    @Test
    void withoutKeysPaymentsAreOffAndQuotaIsNotEnforced() {
        IyzicoClient iyzico = client("", "", "https://sandbox-api.iyzipay.com");
        assertThat(iyzico.isConfigured()).isFalse();
        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(50L);

        assertThat(service(iyzico).canCreateListingByBusiness(7L)).isTrue();
        verifyNoInteractions(subs);
    }

    @Test
    void withoutKeysCheckoutAndCallbackAreRefusedWithoutCallingIyzico() {
        IyzicoClient iyzico = client(null, null, "https://api.iyzipay.com");
        assertThat(iyzico.startCheckout(new Business(), null, BigDecimal.TEN, "P", "c").ok()).isFalse();
        assertThat(iyzico.retrieve("any-token").paid()).isFalse();
    }

    @Test
    void withKeysQuotaIsEnforced() {
        IyzicoClient iyzico = client("live-placeholder", "secret-placeholder", "https://api.iyzipay.com");
        when(subs.findByBusinessId(7L)).thenReturn(Optional.empty());
        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(5L);
        assertThat(service(iyzico).canCreateListingByBusiness(7L)).isFalse();

        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(4L);
        assertThat(service(iyzico).canCreateListingByBusiness(7L)).isTrue();
    }

    @Test
    void resumingCountedListingAllowsUpToQuotaInclusive() {
        IyzicoClient iyzico = client("live-placeholder", "secret-placeholder", "https://api.iyzipay.com");
        when(subs.findByBusinessId(7L)).thenReturn(Optional.empty());
        // 5 acik ilan (duraklatilan dahil): bu ilan haric 4 < 5 → yayina alinabilir
        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(5L);
        assertThat(service(iyzico).canActivateCountedListing(7L)).isTrue();
        // Abonelik bitmis, 6 acik ilan: kota ustu → reddedilir
        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(6L);
        assertThat(service(iyzico).canActivateCountedListing(7L)).isFalse();
    }

    @Test
    void statusReportsPaymentAvailabilityAndSandbox() {
        Business b = new Business();
        b.setId(7L);
        Subscription sub = Subscription.builder().business(b).status(SubscriptionStatus.TRIAL).plan("P").build();
        when(businesses.findByOwnerId(1L)).thenReturn(Optional.of(b));
        when(subs.findByBusinessId(7L)).thenReturn(Optional.of(sub));
        when(subs.save(any())).thenAnswer(i -> i.getArgument(0));

        BillingService.BillingStatus off = service(client("", "", "https://sandbox-api.iyzipay.com")).statusForOwner(1L);
        assertThat(off.paymentsAvailable()).isFalse();
        assertThat(off.enforced()).isFalse();
        assertThat(off.sandbox()).isFalse();

        BillingService.BillingStatus sandbox = service(client("sandbox-x", "sandbox-y", "https://sandbox-api.iyzipay.com")).statusForOwner(1L);
        assertThat(sandbox.paymentsAvailable()).isTrue();
        assertThat(sandbox.enforced()).isTrue();
        assertThat(sandbox.sandbox()).isTrue();

        BillingService.BillingStatus live = service(client("live-x", "live-y", "https://api.iyzipay.com")).statusForOwner(1L);
        assertThat(live.paymentsAvailable()).isTrue();
        assertThat(live.sandbox()).isFalse();
    }

    @Test
    void sandboxDetection() {
        assertThat(IyzicoClient.isSandbox("https://sandbox-api.iyzipay.com", "live")).isTrue();
        assertThat(IyzicoClient.isSandbox("https://api.iyzipay.com", "sandbox-abc")).isTrue();
        assertThat(IyzicoClient.isSandbox("https://api.iyzipay.com", "live-abc")).isFalse();
    }

    // ── callback: oturum tablosu, tekrar oynatma, doğrulama ─────────

    private IyzicoClient configuredMock() {
        IyzicoClient iyzico = mock(IyzicoClient.class);
        when(iyzico.isConfigured()).thenReturn(true);
        return iyzico;
    }

    private static final BigDecimal PRICE = new BigDecimal("499.00");

    private Business biz() {
        Business b = new Business();
        b.setId(7L);
        return b;
    }

    /** iyzico'nun başarılı dönüşü — tutar/sepet/conversation bizim kayıtla eşleşir. */
    private static IyzicoClient.CheckoutResult paid(String paymentId, String conversationId) {
        return new IyzicoClient.CheckoutResult(true, paymentId, "SUCCESS", null,
                PRICE, "SUB-7", conversationId);
    }

    private PaymentCheckout pending(String token, Subscription sub) {
        PaymentCheckout pc = PaymentCheckout.builder().id(1L).business(sub.getBusiness()).token(token)
                .conversationId("sub-7-conv-" + token).status(PaymentCheckoutStatus.PENDING)
                .expectedPrice(PRICE).createdAt(LocalDateTime.now().minusMinutes(2)).build();
        when(checkouts.findByTokenForUpdate(token)).thenReturn(Optional.of(pc));
        when(checkouts.findByToken(token)).thenReturn(Optional.of(pc));
        when(checkouts.save(any())).thenAnswer(i -> i.getArgument(0));
        return pc;
    }

    private Subscription sub() {
        Subscription sub = Subscription.builder().business(biz()).status(SubscriptionStatus.TRIAL).plan("P").build();
        when(subs.findByBusinessId(7L)).thenReturn(Optional.of(sub));
        when(subs.save(any())).thenAnswer(i -> i.getArgument(0));
        return sub;
    }

    @Test
    void checkoutCreatesPendingSessionPerStart() {
        IyzicoClient iyzico = configuredMock();
        Business b = biz();
        Subscription sub = Subscription.builder().business(b).status(SubscriptionStatus.TRIAL).plan("P").build();
        when(businesses.findByOwnerId(1L)).thenReturn(Optional.of(b));
        when(subs.findByBusinessId(7L)).thenReturn(Optional.of(sub));
        when(iyzico.startCheckout(any(), any(), any(), any(), any()))
                .thenReturn(new IyzicoClient.CheckoutInit(true, "tok-a", "url", null, null))
                .thenReturn(new IyzicoClient.CheckoutInit(true, "tok-b", "url", null, null));
        BillingService svc = service(iyzico);

        svc.startCheckout(1L);
        svc.startCheckout(1L);

        // İkinci başlatma birincinin üzerine yazmaz: iki ayrı PENDING oturum.
        ArgumentCaptor<PaymentCheckout> saved = ArgumentCaptor.forClass(PaymentCheckout.class);
        verify(checkouts, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(PaymentCheckout::getToken).containsExactly("tok-a", "tok-b");
        assertThat(saved.getAllValues()).allSatisfy(pc -> {
            assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.PENDING);
            assertThat(pc.getExpectedPrice()).isEqualByComparingTo(PRICE);
            assertThat(pc.getConversationId()).startsWith("sub-7-").hasSizeLessThanOrEqualTo(64);
        });
        assertThat(saved.getAllValues().get(0).getConversationId())
                .isNotEqualTo(saved.getAllValues().get(1).getConversationId());
        assertThat(sub.getLastCheckoutToken()).isNull();
    }

    @Test
    void unknownCallbackTokenDoesNotCallIyzico() {
        IyzicoClient iyzico = configuredMock();
        when(checkouts.findByToken("forged")).thenReturn(Optional.empty());
        when(subs.findByLastCheckoutToken("forged")).thenReturn(Optional.empty());

        assertThat(service(iyzico).handleCallback("forged")).endsWith("sub=fail");
        verify(iyzico, never()).retrieve(any());
    }

    @Test
    void successfulCallbackActivatesAndReplayIsIdempotentOk() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-1", sub);
        when(iyzico.retrieve("tok-1")).thenReturn(paid("pay-1", pc.getConversationId()));
        BillingService svc = service(iyzico);

        assertThat(svc.handleCallback("tok-1")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(sub.getLastPaymentId()).isEqualTo("pay-1");
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.SUCCEEDED);
        assertThat(pc.getPaidPrice()).isEqualByComparingTo(PRICE);
        assertThat(pc.getCompletedAt()).isNotNull();
        LocalDateTime end = sub.getCurrentPeriodEnd();
        assertThat(end).isAfter(LocalDateTime.now().plusDays(27));

        // Tüketilmiş token tekrar gelir: okUrl, iyzico'ya gidilmez, süre uzamaz.
        assertThat(svc.handleCallback("tok-1")).endsWith("sub=ok");
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end);
        verify(iyzico, times(1)).retrieve("tok-1");
    }

    @Test
    void olderCheckoutStillSettlesAfterNewerOneStarted() {
        // Eskiden ikinci checkout lastCheckoutToken'ın üzerine yazıyordu; ödenen ilk
        // oturumun callback'i eşleşmiyordu.
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout first = pending("tok-old", sub);
        pending("tok-new", sub);
        when(iyzico.retrieve("tok-old")).thenReturn(paid("pay-9", first.getConversationId()));

        assertThat(service(iyzico).handleCallback("tok-old")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    }

    @Test
    void paidPriceMismatchFailsAndDoesNotActivate() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-p", sub);
        when(iyzico.retrieve("tok-p")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-p", "SUCCESS", null,
                new BigDecimal("1.00"), "SUB-7", pc.getConversationId()));

        assertThat(service(iyzico).handleCallback("tok-p")).endsWith("sub=fail");
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.FAILED);
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
        assertThat(sub.getCurrentPeriodEnd()).isNull();
    }

    @Test
    void basketOrConversationMismatchFails() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout a = pending("tok-b1", sub);
        when(iyzico.retrieve("tok-b1")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-b1", "SUCCESS", null,
                PRICE, "SUB-8", a.getConversationId()));
        assertThat(service(iyzico).handleCallback("tok-b1")).endsWith("sub=fail");
        assertThat(a.getStatus()).isEqualTo(PaymentCheckoutStatus.FAILED);

        PaymentCheckout b = pending("tok-b2", sub);
        when(iyzico.retrieve("tok-b2")).thenReturn(paid("pay-b2", "sub-7-baska-oturum"));
        assertThat(service(iyzico).handleCallback("tok-b2")).endsWith("sub=fail");
        assertThat(b.getStatus()).isEqualTo(PaymentCheckoutStatus.FAILED);
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
    }

    @Test
    void samePaymentIdIsIdempotentAndDoesNotReactivateCanceled() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        LocalDateTime end = LocalDateTime.now().plusDays(10);
        sub.setStatus(SubscriptionStatus.CANCELED);
        sub.setCurrentPeriodEnd(end);
        sub.setLastPaymentId("pay-2");
        PaymentCheckout pc = pending("tok-2", sub);
        when(iyzico.retrieve("tok-2")).thenReturn(paid("pay-2", pc.getConversationId()));

        assertThat(service(iyzico).handleCallback("tok-2")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end);
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.SUCCEEDED);
    }

    @Test
    void earlyRenewalKeepsRemainingDays() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        LocalDateTime end = LocalDateTime.now().plusDays(10);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setCurrentPeriodEnd(end);
        sub.setLastPaymentId("pay-old");
        PaymentCheckout pc = pending("tok-3", sub);
        when(iyzico.retrieve("tok-3")).thenReturn(paid("pay-new", pc.getConversationId()));

        service(iyzico).handleCallback("tok-3");
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end.plusMonths(1));
        assertThat(sub.getLastPaymentId()).isEqualTo("pay-new");
    }

    @Test
    void lateRenewalStartsFromNow() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setCurrentPeriodEnd(LocalDateTime.now().minusDays(20));
        PaymentCheckout pc = pending("tok-4", sub);
        when(iyzico.retrieve("tok-4")).thenReturn(paid("pay-4", pc.getConversationId()));

        service(iyzico).handleCallback("tok-4");
        assertThat(sub.getCurrentPeriodEnd())
                .isAfter(LocalDateTime.now().plusMonths(1).minusMinutes(1))
                .isBefore(LocalDateTime.now().plusMonths(1).plusMinutes(1));
    }

    @Test
    void failedPaymentClosesSessionAndChangesNothing() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-5", sub);
        when(iyzico.retrieve("tok-5")).thenReturn(new IyzicoClient.CheckoutResult(false, null, "FAILURE", "x"));
        BillingService svc = service(iyzico);

        assertThat(svc.handleCallback("tok-5")).endsWith("sub=fail");
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.FAILED);
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
        assertThat(sub.getCurrentPeriodEnd()).isNull();
        // Kapanmış oturum tekrar gelirse iyzico'ya gidilmez.
        assertThat(svc.handleCallback("tok-5")).endsWith("sub=fail");
        verify(iyzico, times(1)).retrieve("tok-5");
    }

    @Test
    void networkErrorKeepsSessionPendingForReconciliation() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-6", sub);
        when(iyzico.retrieve("tok-6")).thenReturn(new IyzicoClient.CheckoutResult(false, null, null, "timeout"));

        assertThat(service(iyzico).handleCallback("tok-6")).endsWith("sub=fail");
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.PENDING);
    }

    @Test
    void legacyTokenFromSubscriptionIsAdoptedAndVerifiedByPrefix() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        sub.setLastCheckoutToken("tok-legacy");
        when(checkouts.findByToken("tok-legacy")).thenReturn(Optional.empty());
        when(subs.findByLastCheckoutToken("tok-legacy")).thenReturn(Optional.of(sub));
        // Benimsenen oturum kendi transaction'ında yazılır; kilitli okuma onu görür
        java.util.concurrent.atomic.AtomicReference<PaymentCheckout> adopted = new java.util.concurrent.atomic.AtomicReference<>();
        when(checkouts.save(any())).thenAnswer(i -> {
            PaymentCheckout p = i.getArgument(0);
            if ("tok-legacy".equals(p.getToken())) adopted.compareAndSet(null, p);
            return p;
        });
        when(checkouts.findByTokenForUpdate("tok-legacy")).thenAnswer(i -> Optional.ofNullable(adopted.get()));
        when(iyzico.retrieve("tok-legacy")).thenReturn(paid("pay-l", "sub-7-1700000000000"));

        assertThat(service(iyzico).handleCallback("tok-legacy")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(sub.getLastCheckoutToken()).isNull();
    }

    // ── mutabakat ───────────────────────────────────────────────────

    @Test
    void reconcileAppliesPaidPendingAndExpiresOldUnpaid() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout paidOne = pending("tok-r1", sub);
        paidOne.setCreatedAt(LocalDateTime.now().minusMinutes(20));
        PaymentCheckout stale = pending("tok-r2", sub);
        stale.setCreatedAt(LocalDateTime.now().minusHours(25));
        PaymentCheckout young = pending("tok-r3", sub);
        young.setCreatedAt(LocalDateTime.now().minusHours(2));
        when(checkouts.findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(eq(PaymentCheckoutStatus.PENDING), any()))
                .thenReturn(List.of(stale, paidOne, young));
        when(iyzico.retrieve("tok-r1")).thenReturn(paid("pay-r1", paidOne.getConversationId()));
        when(iyzico.retrieve("tok-r2")).thenReturn(new IyzicoClient.CheckoutResult(false, null, null, "not found"));
        when(iyzico.retrieve("tok-r3")).thenReturn(new IyzicoClient.CheckoutResult(false, null, null, "not found"));

        int changed = service(iyzico).reconcilePendingCheckouts();

        assertThat(changed).isEqualTo(2);
        assertThat(paidOne.getStatus()).isEqualTo(PaymentCheckoutStatus.SUCCEEDED);
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(stale.getStatus()).isEqualTo(PaymentCheckoutStatus.EXPIRED);
        assertThat(young.getStatus()).isEqualTo(PaymentCheckoutStatus.PENDING);

        // 15 dakika eşiği sorguya gider
        ArgumentCaptor<LocalDateTime> before = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(checkouts).findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(eq(PaymentCheckoutStatus.PENDING), before.capture());
        assertThat(before.getValue()).isBetween(LocalDateTime.now().minusMinutes(16), LocalDateTime.now().minusMinutes(14));
    }

    /** Gerçek TransactionTemplate mantığıyla kayıt başına transaction'ı sayan sahte yönetici. */
    static final class CountingTxManager implements org.springframework.transaction.PlatformTransactionManager {
        int begun, committed, rolledBack;
        final List<Integer> propagations = new java.util.ArrayList<>();
        @Override public org.springframework.transaction.TransactionStatus getTransaction(
                org.springframework.transaction.TransactionDefinition def) {
            begun++;
            propagations.add(def.getPropagationBehavior());
            return new org.springframework.transaction.support.SimpleTransactionStatus();
        }
        @Override public void commit(org.springframework.transaction.TransactionStatus st) { committed++; }
        @Override public void rollback(org.springframework.transaction.TransactionStatus st) { rolledBack++; }
    }

    @Test
    void reconcileIsolatesFailurePerCheckoutTransaction() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout broken = pending("tok-e1", sub);
        broken.setCreatedAt(LocalDateTime.now().minusMinutes(30));
        PaymentCheckout paidOne = pending("tok-e2", sub);
        paidOne.setCreatedAt(LocalDateTime.now().minusMinutes(20));
        PaymentCheckout stale = pending("tok-e3", sub);
        stale.setCreatedAt(LocalDateTime.now().minusHours(25));
        PaymentCheckout dbBroken = pending("tok-e4", sub);
        dbBroken.setCreatedAt(LocalDateTime.now().minusMinutes(25));
        when(checkouts.findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(eq(PaymentCheckoutStatus.PENDING), any()))
                .thenReturn(List.of(broken, dbBroken, paidOne, stale));
        when(iyzico.retrieve("tok-e1")).thenThrow(new IllegalStateException("iyzico zaman asimi"));
        when(iyzico.retrieve("tok-e2")).thenReturn(paid("pay-e2", paidOne.getConversationId()));
        when(iyzico.retrieve("tok-e3")).thenReturn(new IyzicoClient.CheckoutResult(false, null, null, "not found"));
        when(iyzico.retrieve("tok-e4")).thenReturn(paid("pay-e4", dbBroken.getConversationId()));
        when(checkouts.findByTokenForUpdate("tok-e4")).thenThrow(new IllegalStateException("kilit zaman asimi"));
        CountingTxManager tx = new CountingTxManager();
        BillingService svc = service(iyzico);
        svc.setTransactionManager(tx);

        int changed = svc.reconcilePendingCheckouts();

        // Bir kaydın hatası diğerlerini durdurmaz ve geri almaz
        assertThat(changed).isEqualTo(2);
        assertThat(broken.getStatus()).isEqualTo(PaymentCheckoutStatus.PENDING);
        assertThat(dbBroken.getStatus()).isEqualTo(PaymentCheckoutStatus.PENDING);
        assertThat(paidOne.getStatus()).isEqualTo(PaymentCheckoutStatus.SUCCEEDED);
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(stale.getStatus()).isEqualTo(PaymentCheckoutStatus.EXPIRED);
        // iyzico hatası transaction DIŞINDA (hiç transaction açılmaz); uygulama kayıt başına
        // ayrı REQUIRES_NEW: 3 açıldı (e4, e2, e3), 2 commit, 1 rollback (e4)
        assertThat(tx.begun).isEqualTo(3);
        assertThat(tx.committed).isEqualTo(2);
        assertThat(tx.rolledBack).isEqualTo(1);
        assertThat(tx.propagations).containsOnly(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Test
    void reconcileMethodHasNoOuterTransaction() throws Exception {
        // Dış transaction olsaydı kayıtlar tek birimde kalır, bayat kilitli okuma riski olurdu.
        assertThat(BillingService.class.getMethod("reconcilePendingCheckouts")
                .isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isFalse();
    }

    @Test
    void reconcileSkipsSessionAlreadySettledByCallback() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout listed = pending("tok-s", sub);
        PaymentCheckout locked = PaymentCheckout.builder().id(1L).business(sub.getBusiness()).token("tok-s")
                .conversationId(listed.getConversationId()).status(PaymentCheckoutStatus.SUCCEEDED)
                .expectedPrice(PRICE).build();
        when(checkouts.findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(any(), any())).thenReturn(List.of(listed));
        when(checkouts.findByTokenForUpdate("tok-s")).thenReturn(Optional.of(locked));
        when(checkouts.findByToken("tok-s")).thenReturn(Optional.of(locked));

        assertThat(service(iyzico).reconcilePendingCheckouts()).isZero();
        verify(iyzico, never()).retrieve(any());
    }

    @Test
    void callbackCallsIyzicoOutsideAnyTransactionAndAppliesInShortOne() throws Exception {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-tx", sub);
        CountingTxManager tx = new CountingTxManager();
        int[] openDuringHttp = {-1};
        when(iyzico.retrieve("tok-tx")).thenAnswer(i -> {
            openDuringHttp[0] = tx.begun - tx.committed - tx.rolledBack;
            return paid("pay-tx", pc.getConversationId());
        });
        BillingService svc = service(iyzico);
        svc.setTransactionManager(tx);

        assertThat(svc.handleCallback("tok-tx")).endsWith("sub=ok");

        assertThat(openDuringHttp[0]).isZero();          // HTTP sırasında açık transaction/kilit yok
        assertThat(tx.begun).isEqualTo(1);               // sonuç tek kısa transaction'da uygulandı
        assertThat(tx.committed).isEqualTo(1);
        assertThat(pc.getStatus()).isEqualTo(PaymentCheckoutStatus.SUCCEEDED);
        assertThat(BillingService.class.getMethod("handleCallback", String.class)
                .isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isFalse();
    }

    @Test
    void callbackRechecksStatusUnderLockAfterHttp() {
        // Kilitsiz okumada PENDING; iyzico beklenirken mutabakat sonuçlandırdı → çift uygulama yok
        IyzicoClient iyzico = configuredMock();
        Subscription sub = sub();
        PaymentCheckout pc = pending("tok-race", sub);
        PaymentCheckout settled = PaymentCheckout.builder().id(1L).business(sub.getBusiness()).token("tok-race")
                .conversationId(pc.getConversationId()).status(PaymentCheckoutStatus.SUCCEEDED)
                .expectedPrice(PRICE).build();
        when(checkouts.findByTokenForUpdate("tok-race")).thenReturn(Optional.of(settled));
        when(iyzico.retrieve("tok-race")).thenReturn(paid("pay-race", pc.getConversationId()));

        assertThat(service(iyzico).handleCallback("tok-race")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
        assertThat(sub.getCurrentPeriodEnd()).isNull();
        verify(subs, never()).save(any());
        verify(checkouts, never()).save(any());
    }

    @Test
    void reconcileDoesNothingWithoutPaymentKeys() {
        IyzicoClient iyzico = client("", "", "https://sandbox-api.iyzipay.com");
        assertThat(service(iyzico).reconcilePendingCheckouts()).isZero();
        verifyNoInteractions(checkouts);
    }

    @Test
    void canceledStaysActiveUntilPeriodEnd() {
        IyzicoClient iyzico = configuredMock();
        Business b = new Business();
        b.setId(7L);
        Subscription sub = Subscription.builder().business(b).status(SubscriptionStatus.ACTIVE).plan("P")
                .currentPeriodEnd(LocalDateTime.now().plusDays(5)).build();
        when(businesses.findByOwnerId(1L)).thenReturn(Optional.of(b));
        when(subs.findByBusinessId(7L)).thenReturn(Optional.of(sub));
        when(subs.save(any())).thenAnswer(i -> i.getArgument(0));
        when(listings.countByBusiness_IdAndStatusNot(7L, ListingStatus.CLOSED)).thenReturn(50L);
        BillingService svc = service(iyzico);

        BillingService.BillingStatus st = svc.cancel(1L);
        assertThat(st.status()).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(st.active()).isTrue();
        assertThat(svc.canCreateListingByBusiness(7L)).isTrue();

        // Dönem geçince ödenmiş hak biter, kota yeniden uygulanır.
        sub.setCurrentPeriodEnd(LocalDateTime.now().minusMinutes(1));
        assertThat(svc.statusForOwner(1L).active()).isFalse();
        assertThat(svc.canCreateListingByBusiness(7L)).isFalse();
    }
}
