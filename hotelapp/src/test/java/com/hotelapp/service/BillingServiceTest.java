package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.Subscription;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.SubscriptionStatus;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.SubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Ödeme yapılandırılmamışsa (iyzico anahtarı yok) kota uygulanmaz ve iyzico
 * çağrılmaz. Eskiden boşken sandbox anahtarlarına düşülüyordu.
 */
class BillingServiceTest {

    private SubscriptionRepository subs;
    private BusinessRepository businesses;
    private JobListingRepository listings;

    @BeforeEach
    void setUp() {
        subs = mock(SubscriptionRepository.class);
        businesses = mock(BusinessRepository.class);
        listings = mock(JobListingRepository.class);
    }

    private BillingService service(IyzicoClient iyzico) {
        BillingService s = new BillingService(subs, businesses, listings, iyzico);
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

    // ── callback tekrar oynatma / iptal / yenileme ───────────────────

    private IyzicoClient configuredMock() {
        IyzicoClient iyzico = mock(IyzicoClient.class);
        when(iyzico.isConfigured()).thenReturn(true);
        return iyzico;
    }

    private Subscription subWithToken(String token) {
        Business b = new Business();
        b.setId(7L);
        Subscription sub = Subscription.builder().business(b).status(SubscriptionStatus.TRIAL)
                .plan("P").lastCheckoutToken(token).build();
        when(subs.findByLastCheckoutToken(token)).thenReturn(Optional.of(sub));
        when(subs.save(any())).thenAnswer(i -> i.getArgument(0));
        return sub;
    }

    @Test
    void unknownCallbackTokenDoesNotCallIyzico() {
        IyzicoClient iyzico = configuredMock();
        when(subs.findByLastCheckoutToken("forged")).thenReturn(Optional.empty());

        assertThat(service(iyzico).handleCallback("forged")).endsWith("sub=fail");
        verify(iyzico, never()).retrieve(any());
    }

    @Test
    void successfulCallbackConsumesTokenAndReplayDoesNotExtend() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = subWithToken("tok-1");
        when(iyzico.retrieve("tok-1")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-1", "SUCCESS", null));
        BillingService svc = service(iyzico);

        assertThat(svc.handleCallback("tok-1")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(sub.getLastCheckoutToken()).isNull();
        assertThat(sub.getLastPaymentId()).isEqualTo("pay-1");
        LocalDateTime end = sub.getCurrentPeriodEnd();
        assertThat(end).isAfter(LocalDateTime.now().plusDays(27));

        // Token tüketildi: ikinci çağrı abonelik bulamaz, iyzico'ya gitmez, süre uzamaz.
        when(subs.findByLastCheckoutToken("tok-1")).thenReturn(Optional.empty());
        assertThat(svc.handleCallback("tok-1")).endsWith("sub=fail");
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end);
        verify(iyzico, times(1)).retrieve("tok-1");
    }

    @Test
    void samePaymentIdIsIdempotentAndDoesNotReactivateCanceled() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = subWithToken("tok-2");
        LocalDateTime end = LocalDateTime.now().plusDays(10);
        sub.setStatus(SubscriptionStatus.CANCELED);
        sub.setCurrentPeriodEnd(end);
        sub.setLastPaymentId("pay-2");
        when(iyzico.retrieve("tok-2")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-2", "SUCCESS", null));

        assertThat(service(iyzico).handleCallback("tok-2")).endsWith("sub=ok");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end);
        assertThat(sub.getLastCheckoutToken()).isNull();
    }

    @Test
    void earlyRenewalKeepsRemainingDays() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = subWithToken("tok-3");
        LocalDateTime end = LocalDateTime.now().plusDays(10);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setCurrentPeriodEnd(end);
        sub.setLastPaymentId("pay-old");
        when(iyzico.retrieve("tok-3")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-new", "SUCCESS", null));

        service(iyzico).handleCallback("tok-3");
        assertThat(sub.getCurrentPeriodEnd()).isEqualTo(end.plusMonths(1));
        assertThat(sub.getLastPaymentId()).isEqualTo("pay-new");
    }

    @Test
    void lateRenewalStartsFromNow() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = subWithToken("tok-4");
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setCurrentPeriodEnd(LocalDateTime.now().minusDays(20));
        when(iyzico.retrieve("tok-4")).thenReturn(new IyzicoClient.CheckoutResult(true, "pay-4", "SUCCESS", null));

        service(iyzico).handleCallback("tok-4");
        assertThat(sub.getCurrentPeriodEnd())
                .isAfter(LocalDateTime.now().plusMonths(1).minusMinutes(1))
                .isBefore(LocalDateTime.now().plusMonths(1).plusMinutes(1));
    }

    @Test
    void failedPaymentChangesNothing() {
        IyzicoClient iyzico = configuredMock();
        Subscription sub = subWithToken("tok-5");
        when(iyzico.retrieve("tok-5")).thenReturn(new IyzicoClient.CheckoutResult(false, null, "FAILURE", "x"));

        assertThat(service(iyzico).handleCallback("tok-5")).endsWith("sub=fail");
        assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
        assertThat(sub.getCurrentPeriodEnd()).isNull();
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
