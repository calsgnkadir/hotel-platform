package com.hotelapp.config;

import com.hotelapp.entity.User;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.EmailService;
import com.hotelapp.service.NotificationService;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.CronTask;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import javax.sql.DataSource;
import java.time.Duration;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Gercek Spring baglami (H2): bildirim commit sonrasi + asenkron, zamanlayici havuzu,
 * HTTP zaman asimlari.
 */
@SpringBootTest
@ActiveProfiles("test")
class AsyncInfrastructureTest {

    @Autowired NotificationService notificationService;
    @Autowired NotificationRepository notificationRepository;
    @Autowired UserRepository userRepository;
    @Autowired TransactionTemplate tx;
    @Autowired DataSource dataSource;
    @Autowired ScheduledAnnotationBeanPostProcessor scheduledProcessor;
    @Autowired @Qualifier("taskScheduler") ThreadPoolTaskScheduler taskScheduler;
    @Autowired @Qualifier("notificationExecutor") ThreadPoolTaskExecutor notificationExecutor;
    @Autowired EmailService emailService;
    @Autowired @Qualifier("taskExecutor") ThreadPoolTaskExecutor taskExecutor;
    @Autowired com.hotelapp.event.NoShowEventListener noShowEventListener;
    @Autowired org.springframework.context.ApplicationContext context;

    private Long newUser() {
        return tx.execute(s -> userRepository.save(User.builder()
                .email("n-" + UUID.randomUUID() + "@test.local").password("x").fullName("Bildirim")
                .role(Role.CANDIDATE).isStudent(false).strikesRemaining(3).enabled(true).build()).getId());
    }

    private static boolean await(BooleanSupplier cond, long ms) throws InterruptedException {
        long end = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < end) {
            if (cond.getAsBoolean()) return true;
            Thread.sleep(25);
        }
        return cond.getAsBoolean();
    }

    private void drain() throws InterruptedException {
        await(() -> notificationExecutor.getActiveCount() == 0
                && notificationExecutor.getThreadPoolExecutor().getQueue().isEmpty(), 5000);
    }

    @Test
    @DisplayName("Commit edilen islemde bildirim commit sonrasi yazilir")
    void commit_notificationWritten() throws Exception {
        Long uid = newUser();
        tx.executeWithoutResult(s ->
                notificationService.notify(uid, NotificationType.GENERIC, "T", "M", null));

        assertThat(await(() -> notificationRepository.countUnread(uid) == 1, 5000)).isTrue();
    }

    @Test
    @DisplayName("Geri alinan islemde bildirim hic yazilmaz")
    void rollback_noNotification() throws Exception {
        Long uid = newUser();
        tx.executeWithoutResult(s -> {
            notificationService.notify(uid, NotificationType.GENERIC, "T", "M", null);
            s.setRollbackOnly();
        });

        drain();
        Thread.sleep(200);
        assertThat(notificationRepository.countUnread(uid)).isZero();
    }

    @Test
    @DisplayName("Transaction disinda cagri calisir (asenkron)")
    void noTransaction_works() throws Exception {
        Long uid = newUser();
        notificationService.notify(uid, NotificationType.GENERIC, "T", "M", null);

        assertThat(await(() -> notificationRepository.countUnread(uid) == 1, 5000)).isTrue();
    }

    /** Test olayi — senkron AFTER_COMMIT dinleyicisinden notify. */
    record ProbeEvent(Long userId) {}

    @Test
    @DisplayName("Senkron @TransactionalEventListener(AFTER_COMMIT) icinden notify: bildirim yazilir")
    void notifyFromAfterCommitListener_isDelivered() throws Exception {
        Long uid = newUser();
        var listener = org.springframework.transaction.event.TransactionalApplicationListener.<ProbeEvent>forPayload(
                org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT,
                e -> notificationService.notify(e.userId(), NotificationType.GENERIC, "T", "M", null));
        ((org.springframework.context.ConfigurableApplicationContext) context).addApplicationListener(listener);
        try {
            tx.executeWithoutResult(s -> context.publishEvent(new ProbeEvent(uid)));
            assertThat(await(() -> notificationRepository.countUnread(uid) == 1, 5000)).isTrue();
        } finally {
            ((org.springframework.context.ConfigurableApplicationContext) context).removeApplicationListener(listener);
        }
    }

    @Test
    @DisplayName("Baska bir senkronizasyonun afterCommit'i icinden notify: bildirim kaybolmaz")
    void notifyFromAnotherAfterCommitCallback_isDelivered() throws Exception {
        Long uid = newUser();
        tx.executeWithoutResult(s -> org.springframework.transaction.support.TransactionSynchronizationManager
                .registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override public void afterCommit() {
                        notificationService.notify(uid, NotificationType.GENERIC, "T", "M", null);
                    }
                }));

        assertThat(await(() -> notificationRepository.countUnread(uid) == 1, 5000)).isTrue();
    }

    @Test
    @DisplayName("Dis islemde notify ikinci DB baglantisi acmaz")
    void insideTransaction_noSecondConnection() throws Exception {
        Long uid = newUser();
        drain();
        var pool = ((HikariDataSource) dataSource).getHikariPoolMXBean();
        int[] activeInside = new int[2];
        tx.executeWithoutResult(s -> {
            userRepository.findById(uid);                    // dis islemin baglantisi alinsin
            activeInside[0] = pool.getActiveConnections();
            for (int i = 0; i < 50; i++) {
                notificationService.notify(uid, NotificationType.GENERIC, "T", "M" + i, null);
            }
            activeInside[1] = pool.getActiveConnections();
        });

        assertThat(activeInside[1]).isEqualTo(activeInside[0]);
        // dedupe: 50 cagri tek okunmamis kayitta toplanir
        assertThat(await(() -> notificationRepository.countUnread(uid) == 1, 5000)).isTrue();
    }

    @Test
    @DisplayName("@Scheduled isler 'taskScheduler' (4 thread, kadrom-sched-) uzerinde; WS heartbeat ayri")
    void scheduledJobsUseDedicatedScheduler() {
        assertThat(taskScheduler.getPoolSize()).isEqualTo(4);
        assertThat(taskScheduler.getThreadNamePrefix()).isEqualTo("kadrom-sched-");

        // Spring 6.1: registrar bir TaskSchedulerRouter tutar; varsayilan zamanlayiciyi
        // (birden fazla TaskScheduler varken "taskScheduler" adli bean) tembel cozer.
        var registrar = (ScheduledTaskRegistrar) ReflectionTestUtils.getField(scheduledProcessor, "registrar");
        Object resolved = ReflectionTestUtils.invokeMethod(registrar.getScheduler(), "determineDefaultScheduler");
        assertThat(resolved).isSameAs(taskScheduler);
        assertThat(scheduledProcessor.getScheduledTasks()).isNotEmpty();

        // Kayitli (gecikmeli de olsa) @Scheduled isler bu havuzun thread'lerini baslatir
        assertThat(Thread.getAllStackTraces().keySet()).anyMatch(t -> t.getName().startsWith("kadrom-sched-"));
    }

    @Test
    @DisplayName("Test profili: zamanlanmis is kendiliginden tetiklenmez (cron kapali, fixed-delay ~1 yil gecikmeli)")
    void scheduledJobsDoNotAutoFireInTestProfile() {
        var tasks = scheduledProcessor.getScheduledTasks().stream().map(ScheduledTask::getTask).toList();
        assertThat(tasks).noneMatch(t -> t instanceof CronTask);
        assertThat(tasks).filteredOn(t -> t instanceof FixedDelayTask)
                .isNotEmpty()
                .allSatisfy(t -> assertThat(((FixedDelayTask) t).getInitialDelayDuration())
                        .isGreaterThan(Duration.ofDays(30)));
    }

    @Test
    @DisplayName("Niteleyicisiz @Async sinirli 'taskExecutor' havuzunda (SimpleAsyncTaskExecutor degil)")
    void unqualifiedAsyncUsesBoundedTaskExecutor() throws Exception {
        var advised = (org.springframework.aop.framework.Advised) noShowEventListener;
        var interceptor = java.util.Arrays.stream(advised.getAdvisors())
                .map(org.springframework.aop.Advisor::getAdvice)
                .filter(a -> a instanceof org.springframework.aop.interceptor.AsyncExecutionInterceptor)
                .findFirst().orElseThrow();
        var method = com.hotelapp.event.NoShowEventListener.class
                .getMethod("onNoShowMarked", com.hotelapp.event.NoShowMarkedEvent.class);

        Object executor = ReflectionTestUtils.invokeMethod(interceptor, "determineAsyncExecutor", method);

        assertThat(executor).isSameAs(taskExecutor);
        assertThat(taskExecutor.getMaxPoolSize()).isEqualTo(4);
        assertThat(taskExecutor.getThreadNamePrefix()).isEqualTo("async-");
    }

    @Test
    @DisplayName("EmailService RestTemplate zaman asimlari: connect 5 sn, read 10 sn")
    void emailTimeouts() {
        EmailService target = AopTestUtils.getTargetObject(emailService);
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(target, "restTemplate");
        var f = (SimpleClientHttpRequestFactory) rt.getRequestFactory();
        assertThat(ReflectionTestUtils.getField(f, "connectTimeout")).isEqualTo(5000);
        assertThat(ReflectionTestUtils.getField(f, "readTimeout")).isEqualTo(10000);
    }
}
