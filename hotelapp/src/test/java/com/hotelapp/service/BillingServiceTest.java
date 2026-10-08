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
}
