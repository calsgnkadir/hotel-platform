package com.hotelapp.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Arka plan is parcacigi havuzlari.
 *
 * <p><b>taskScheduler</b> — {@code @Scheduled} isleri. Acikca tanimlanir cunku
 * {@code @EnableWebSocketMessageBroker} kendi {@code messageBrokerTaskScheduler}
 * bean'ini kaydediyor; Boot'un otomatik zamanlayicisi bu yuzden geri cekiliyor ve
 * {@code spring.task.scheduling.pool.size} hic uygulanmiyordu (@Scheduled isler
 * SockJS heartbeat havuzunda kosuyordu). Birden fazla TaskScheduler oldugunda
 * Spring {@code @Scheduled} icin "taskScheduler" adli bean'i secer.
 *
 * <p><b>notificationExecutor</b> — uygulama ici bildirim kaydi + WS/web push.
 * Kuyruk dolarsa CallerRuns: bildirim kaybolmaz, cagiran yavaslar (geri basinc).
 * Bu yol yalniz 500'luk kuyruk tasinca devreye girer ve eski (senkron) davranisa
 * esdegerdir.
 *
 * <p><b>smsExecutor</b> — SMS saglayici HTTP cagrisi. SMS zaten best-effort (push'a EK
 * kanal); kuyruk dolarsa gorev loglanip atilir — istek thread'i 15 sn'lik HTTP
 * cagrisina bloklanmasin.
 *
 * <p>Varsayilan {@code @Async} executor'u (adsiz) bu sinifta tanimlanmaz; mevcut
 * davranis degismez.
 */
@Configuration
@Slf4j
public class AsyncConfig {

    @Bean(name = "taskScheduler")
    public ThreadPoolTaskScheduler taskScheduler(
            @Value("${spring.task.scheduling.pool.size:4}") int poolSize,
            @Value("${spring.task.scheduling.thread-name-prefix:kadrom-sched-}") String prefix) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(poolSize);
        scheduler.setThreadNamePrefix(prefix);
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(20);
        return scheduler;
    }

    @Bean(name = "notificationExecutor")
    public ThreadPoolTaskExecutor notificationExecutor(
            @Value("${app.notifications.executor.core-size:2}") int core,
            @Value("${app.notifications.executor.max-size:4}") int max,
            @Value("${app.notifications.executor.queue-capacity:500}") int queue) {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(core);
        ex.setMaxPoolSize(max);
        ex.setQueueCapacity(queue);
        ex.setThreadNamePrefix("notify-");
        ex.setRejectedExecutionHandler((r, pool) -> {
            if (pool.isShutdown()) {
                log.warn("[NOTIFY] executor kapali, bildirim atlandi");
                return;
            }
            log.warn("[NOTIFY] kuyruk dolu ({}), bildirim cagiran thread'de calisiyor", queue);
            r.run();
        });
        ex.setWaitForTasksToCompleteOnShutdown(true);
        ex.setAwaitTerminationSeconds(20);
        return ex;
    }

    @Bean(name = "smsExecutor")
    public ThreadPoolTaskExecutor smsExecutor(
            @Value("${app.sms.executor.core-size:1}") int core,
            @Value("${app.sms.executor.max-size:2}") int max,
            @Value("${app.sms.executor.queue-capacity:500}") int queue) {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(core);
        ex.setMaxPoolSize(max);
        ex.setQueueCapacity(queue);
        ex.setThreadNamePrefix("sms-");
        ex.setRejectedExecutionHandler((r, pool) ->
                log.warn("[SMS] kuyruk dolu ya da executor kapali — SMS atlandi (best-effort)"));
        ex.setWaitForTasksToCompleteOnShutdown(true);
        ex.setAwaitTerminationSeconds(20);
        return ex;
    }

    /** Ortak HTTP zaman asimlari (Resend, SMS saglayici). */
    public static org.springframework.http.client.SimpleClientHttpRequestFactory httpRequestFactory(
            int connectTimeoutMs, int readTimeoutMs) {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(connectTimeoutMs);
        f.setReadTimeout(readTimeoutMs);
        return f;
    }
}
