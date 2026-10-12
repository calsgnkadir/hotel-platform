package com.hotelapp.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** SMS: cagirani bloklamaz (executor), commit sonrasi gider, rollback'te gitmez; zaman asimlari ayarli. */
class SmsServiceAsyncTest {

    private final List<Runnable> queued = new ArrayList<>();

    private SmsService sms() {
        return new SmsService(false, "netgsm", "", "", "", "https://example.invalid",
                queued::add, 1234, 5678);
    }

    @AfterEach
    void clearSync() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("Transaction yok: is hemen executor kuyruguna verilir, cagiran HTTP beklemez")
    void noTx_queuedImmediately() {
        SmsService s = sms();
        for (int i = 0; i < 200; i++) s.send("05551234567", "Acil vardiya");
        assertThat(queued).hasSize(200);
    }

    @Test
    @DisplayName("Dis transaction: commit'e kadar kuyruga girmez; rollback'te hic girmez")
    void tx_deferredAndRollbackDropped() {
        SmsService s = sms();
        TransactionSynchronizationManager.initSynchronization();
        s.send("05551234567", "Acil vardiya");
        assertThat(queued).isEmpty();
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(x -> x.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        assertThat(queued).isEmpty();

        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.initSynchronization();
        s.send("05551234567", "Acil vardiya");
        TransactionSynchronizationManager.getSynchronizations().forEach(x -> x.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        assertThat(queued).hasSize(1);
    }

    @Test
    @DisplayName("Executor reddederse cagiran patlamaz")
    void rejected_swallowed() {
        SmsService s = new SmsService(false, "netgsm", "", "", "", "https://example.invalid",
                r -> { throw new java.util.concurrent.RejectedExecutionException("dolu"); }, 1, 1);
        s.send("05551234567", "x");
    }

    @Test
    @DisplayName("RestTemplate connect/read zaman asimlari ayarli")
    void timeouts() {
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(sms(), "restTemplate");
        var f = (SimpleClientHttpRequestFactory) rt.getRequestFactory();
        assertThat(ReflectionTestUtils.getField(f, "connectTimeout")).isEqualTo(1234);
        assertThat(ReflectionTestUtils.getField(f, "readTimeout")).isEqualTo(5678);
    }
}
