package com.hotelapp.config;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Yan etkiyi (bildirim, WS yayini, SMS) dis transaction commit edildikten SONRA calistirir.
 *
 * <ul>
 *   <li>Aktif transaction senkronizasyonu varsa: kaydedilir, yalniz
 *       {@code afterCompletion(STATUS_COMMITTED)} ile calisir; dis islem geri alinirsa
 *       hic calismaz.</li>
 *   <li>Senkronizasyon yoksa (transaction disi, ya da Spring'in AFTER_COMMIT
 *       {@code @TransactionalEventListener}'lari — bunlar afterCompletion'da, senkronizasyon
 *       temizlendikten sonra kosar): hemen calisir.</li>
 * </ul>
 *
 * <p>Neden {@code afterCommit} degil: Spring {@code afterCommit} geri cagrilarini commit
 * aninda alinmis bir kopya listeden calistirir; baska bir senkronizasyonun afterCommit'i
 * icinden kaydedilen yeni senkronizasyonun {@code afterCommit}'i HIC cagrilmaz (yan etki
 * sessizce kaybolurdu). {@code afterCompletion} ise listeyi afterCommit fazindan SONRA
 * yeniden okur — bu durumda da calisir.
 *
 * <p>Not: bu an dis transaction'in baglantisi henuz serbest birakilmamis olabilir;
 * {@code action} DB isini dogrudan yapmamali, bir executor'a devretmeli (ya da REQUIRES_NEW).
 */
public final class AfterCommit {

    private AfterCommit() {}

    public static void run(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_COMMITTED) action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
