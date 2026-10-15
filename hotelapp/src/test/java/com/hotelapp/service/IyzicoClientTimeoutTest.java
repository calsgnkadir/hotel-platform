package com.hotelapp.service;

import com.iyzipay.model.CheckoutForm;
import com.iyzipay.request.RetrieveCheckoutFormRequest;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * iyzipay-java'nın HTTP zaman aşımı kütüphanede sabit 140 sn. IyzicoClient çağrıyı
 * sınırlı havuzda koşturup en fazla app.iyzico.timeout-ms bekler. Gerçek iyzico'ya
 * istek atılmaz: bloklayan çağrı alt sınıfta taklit edilir.
 */
class IyzicoClientTimeoutTest {

    @Test
    void retrieveReturnsPendingResultWhenIyzicoHangs() {
        CountDownLatch release = new CountDownLatch(1);
        IyzicoClient client = new IyzicoClient("test-key", "test-secret",
                "https://sandbox-api.iyzipay.com", "https://api.kadrom.me/api/billing/callback", 200) {
            @Override
            CheckoutForm retrieveBlocking(RetrieveCheckoutFormRequest req) {
                try {
                    release.await(10, TimeUnit.SECONDS);   // iyzico yanıt vermiyor
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return new CheckoutForm();
            }
        };
        try {
            long start = System.nanoTime();
            IyzicoClient.CheckoutResult r = client.retrieve("tok-hang");
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

            assertThat(elapsedMs).isLessThan(3_000);
            assertThat(r.paid()).isFalse();
            // paymentStatus null → BillingService oturumu PENDING bırakır (mutabakat tekrar dener)
            assertThat(r.paymentStatus()).isNull();
            assertThat(r.error()).contains("zaman aşımı");
        } finally {
            release.countDown();
            client.shutdown();
        }
    }

    @Test
    void retrieveStillWorksWithinTimeout() {
        IyzicoClient client = new IyzicoClient("test-key", "test-secret",
                "https://sandbox-api.iyzipay.com", "https://api.kadrom.me/api/billing/callback", 2_000) {
            @Override
            CheckoutForm retrieveBlocking(RetrieveCheckoutFormRequest req) {
                CheckoutForm f = new CheckoutForm();
                f.setStatus("success");
                f.setPaymentStatus("SUCCESS");
                f.setPaymentId("pay-1");
                return f;
            }
        };
        try {
            IyzicoClient.CheckoutResult r = client.retrieve("tok-ok");
            assertThat(r.paid()).isTrue();
            assertThat(r.paymentId()).isEqualTo("pay-1");
        } finally {
            client.shutdown();
        }
    }
}
