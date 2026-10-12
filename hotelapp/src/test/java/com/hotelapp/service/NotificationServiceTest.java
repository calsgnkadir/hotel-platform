package com.hotelapp.service;

import com.hotelapp.entity.Notification;
import com.hotelapp.entity.User;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FAZ 9.3 — NotificationService unit test.
 *
 * Kritik kontrat:
 *  - notify(...) recipient bulunamazsa sessizce cikar (crash yok)
 *  - notify(...) exception firlatirsa caller etkilenmez (ayri executor + kendi tx + try-catch)
 *  - dis transaction varsa yalniz commit SONRASI teslim edilir; rollback'te hic gitmez
 *  - markRead sadece kendi bildirimini isaretler (ownership check)
 *  - list limit'i 50 ile clamp eder
 */
@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private WebPushService webPushService;

    @Mock private PlatformTransactionManager txManager;

    private NotificationService service;
    /** Executor'a verilen isler — testte elle (ya da hemen) calistirilir. */
    private final List<Runnable> queued = new ArrayList<>();
    private boolean runInline = true;

    private User user;

    @BeforeEach
    void setUp() {
        // Bildirim artik notificationExecutor'da teslim ediliyor. Mevcut testler icin
        // executor senkron (Runnable::run) — davranis kontrati ayni kalir.
        Executor executor = job -> { if (runInline) job.run(); else queued.add(job); };
        service = new NotificationService(notificationRepository, userRepository,
                messagingTemplate, webPushService, executor, txManager);
        user = new User();
        user.setId(42L);
        user.setEmail("test@example.com");
    }

    @Nested @DisplayName("notify()")
    class Notify {

        @Test
        @DisplayName("Recipient bulunamazsa sessizce cikar (crash yok, save cagrilmaz)")
        void nonExistentRecipient() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            service.notify(999L, NotificationType.APPLICATION_ACCEPTED, "T", "M", "/link");

            verify(notificationRepository, never()).save(any());
            verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any());
        }

        @Test
        @DisplayName("Happy path: notification olusturulur + WS push + web push cagrilir")
        void happyPath() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            when(notificationRepository.save(any(Notification.class)))
                    .thenAnswer(inv -> {
                        Notification n = inv.getArgument(0);
                        n.setId(1L);
                        return n;
                    });

            service.notify(42L, NotificationType.APPLICATION_ACCEPTED, "Basvurun kabul edildi", "Detay", "/apps/1");

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertThat(saved.getRecipient()).isEqualTo(user);
            assertThat(saved.getType()).isEqualTo(NotificationType.APPLICATION_ACCEPTED);
            assertThat(saved.getTitle()).isEqualTo("Basvurun kabul edildi");
            assertThat(saved.getMessage()).isEqualTo("Detay");
            assertThat(saved.getLink()).isEqualTo("/apps/1");
            assertThat(saved.getIsRead()).isFalse();
            assertThat(saved.getCreatedAt()).isNotNull();

            // WS push cagrilmali
            verify(messagingTemplate).convertAndSendToUser(
                    eq("test@example.com"),
                    eq("/queue/notifications"),
                    any());

            // Web push cagrilmali — icerikli
            ArgumentCaptor<WebPushService.PushMessage> push = ArgumentCaptor.forClass(WebPushService.PushMessage.class);
            verify(webPushService).sendToUser(eq(42L), push.capture());
            assertThat(push.getValue().title()).isEqualTo("Basvurun kabul edildi");
            assertThat(push.getValue().body()).isEqualTo("Detay");
            assertThat(push.getValue().url()).isEqualTo("/apps/1");
            assertThat(push.getValue().notificationId()).isEqualTo(1L);
        }

        @Test
        @DisplayName("Push adresi: sekme adi alicinin paneline cevrilir, tam adres aynen kalir")
        void pushUrl_resolvesTabsByRole() {
            User candidate = new User();
            candidate.setRole(com.hotelapp.enums.Role.CANDIDATE);
            User owner = new User();
            owner.setRole(com.hotelapp.enums.Role.BUSINESS_OWNER);

            assertThat(NotificationService.pushUrl(candidate, "applications")).isEqualTo("/candidate?tab=applications");
            assertThat(NotificationService.pushUrl(owner, "listings")).isEqualTo("/business?tab=listings");
            assertThat(NotificationService.pushUrl(owner, "/listings/42")).isEqualTo("/listings/42");
            assertThat(NotificationService.pushUrl(candidate, null)).isEqualTo("/candidate");
            assertThat(NotificationService.pushUrl(new User(), "messages")).isEqualTo("/candidate?tab=messages");
        }

        @Test
        @DisplayName("WS push exception firlatirsa web push yine de calisir (izolasyon)")
        void wsFailureDoesNotBlockWebPush() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("WS broker down"))
                    .when(messagingTemplate).convertAndSendToUser(any(), any(), any());

            service.notify(42L, NotificationType.NEW_MESSAGE, "T", "M", null);

            // Web push yine de cagrilmali
            verify(webPushService).sendToUser(eq(42L), any());
        }

        @Test
        @DisplayName("Web push exception firlatirsa caller crash olmamali (swallow)")
        void webPushFailureSwallowed() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("VAPID key missing"))
                    .when(webPushService).sendToUser(anyLong(), any());

            // Crash olmamali
            service.notify(42L, NotificationType.GENERIC, "T", "M", null);

            verify(notificationRepository).save(any(Notification.class));
        }
    }

    @Nested @DisplayName("notify() commit sonrasi + asenkron")
    class NotifyAfterCommit {

        @org.junit.jupiter.api.AfterEach
        void clearSync() {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.clearSynchronization();
            }
        }

        private void stubHappy() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("Dis transaction icinde: commit'e kadar hicbir sey yazilmaz/gonderilmez")
        void deferredUntilCommit() {
            TransactionSynchronizationManager.initSynchronization();

            service.notify(42L, NotificationType.NEW_MESSAGE, "T", "M", null);

            // dis islem hala acik: DB'ye dokunulmadi (ikinci baglanti yok), push yok
            verifyNoInteractions(userRepository, notificationRepository, messagingTemplate, webPushService, txManager);

            stubHappy();
            TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));

            verify(notificationRepository).save(any(Notification.class));
            verify(messagingTemplate).convertAndSendToUser(eq("test@example.com"), eq("/queue/notifications"), any());
            verify(webPushService).sendToUser(eq(42L), any());
        }

        @Test
        @DisplayName("Dis transaction geri alinirsa bildirim hic yazilmaz/gonderilmez")
        void rollback_nothingSent() {
            TransactionSynchronizationManager.initSynchronization();

            service.notify(42L, NotificationType.NEW_MESSAGE, "T", "M", null);
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

            verifyNoInteractions(userRepository, notificationRepository, messagingTemplate, webPushService);
        }

        @Test
        @DisplayName("Toplu bildirim cagirani bloklamaz: isler executor kuyruguna gider")
        void bulk_doesNotBlockCaller() {
            runInline = false;

            for (long i = 0; i < 200; i++) {
                service.notify(42L, NotificationType.URGENT_LISTING, "Acil", "M", null);
            }

            assertThat(queued).hasSize(200);
            verifyNoInteractions(userRepository, notificationRepository, messagingTemplate, webPushService);

            stubHappy();
            queued.get(0).run();
            verify(notificationRepository).save(any(Notification.class));
        }

        @Test
        @DisplayName("Kayit kendi transaction'inda yapilir (txManager uzerinden)")
        void persistsInOwnTransaction() {
            stubHappy();

            service.notify(42L, NotificationType.GENERIC, "T", "M", null);

            verify(txManager).getTransaction(any());
            verify(txManager).commit(any());
        }

        @Test
        @DisplayName("Executor reddederse cagiran patlamaz")
        void executorRejects_callerSafe() {
            service = new NotificationService(notificationRepository, userRepository, messagingTemplate,
                    webPushService, job -> { throw new java.util.concurrent.RejectedExecutionException("dolu"); },
                    txManager);

            service.notify(42L, NotificationType.GENERIC, "T", "M", null);

            verifyNoInteractions(notificationRepository);
        }
    }

    @Nested @DisplayName("notify() dedupe — FAZ 11.W4.1")
    class NotifyDedupe {

        @Test
        @DisplayName("Pencere icinde ayni type varsa yeni kayit acilmaz, count artar")
        void aggregatesWithinWindow() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            Notification existing = Notification.builder()
                    .id(7L).recipient(user)
                    .type(NotificationType.NEW_APPLICATION)
                    .title("Yeni başvuru").message("Ali başvurdu")
                    .isRead(false).aggregateCount(2)
                    .createdAt(java.time.LocalDateTime.now().minusMinutes(2))
                    .build();
            when(notificationRepository
                    .findFirstByRecipientIdAndTypeAndIsReadFalseAndCreatedAtAfterOrderByCreatedAtDesc(
                            eq(42L), eq(NotificationType.NEW_APPLICATION), any()))
                    .thenReturn(Optional.of(existing));
            when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

            service.notify(42L, NotificationType.NEW_APPLICATION, "Yeni başvuru", "Zeynep başvurdu", "applications");

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertThat(saved.getId()).isEqualTo(7L);              // ayni kayit
            assertThat(saved.getAggregateCount()).isEqualTo(3);   // 2 -> 3
            assertThat(saved.getMessage()).isEqualTo("Zeynep başvurdu");  // en yeni mesaj
        }

        @Test
        @DisplayName("Pencere disinda (veya okunmus) ise yeni kayit acilir")
        void createsNewOutsideWindow() {
            when(userRepository.findById(42L)).thenReturn(Optional.of(user));
            when(notificationRepository
                    .findFirstByRecipientIdAndTypeAndIsReadFalseAndCreatedAtAfterOrderByCreatedAtDesc(
                            eq(42L), any(), any()))
                    .thenReturn(Optional.empty());
            when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

            service.notify(42L, NotificationType.NEW_APPLICATION, "Yeni başvuru", "Can başvurdu", "applications");

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getId()).isNull();               // yeni kayit
            assertThat(captor.getValue().getAggregateCount()).isEqualTo(1);
        }
    }

    @Nested @DisplayName("markRead()")
    class MarkRead {

        @Test
        @DisplayName("Ownership check gecerse isRead=true set edilir")
        void ownRead() {
            Notification n = Notification.builder()
                    .id(5L).recipient(user).isRead(false).build();
            when(notificationRepository.findById(5L)).thenReturn(Optional.of(n));

            service.markRead(5L, 42L);

            assertThat(n.getIsRead()).isTrue();
            verify(notificationRepository).save(n);
        }

        @Test
        @DisplayName("Baska kullanicinin notification'ini isaretlemez (sessizce noop)")
        void foreignReadIgnored() {
            Notification n = Notification.builder()
                    .id(5L).recipient(user).isRead(false).build();
            when(notificationRepository.findById(5L)).thenReturn(Optional.of(n));

            service.markRead(5L, 999L);  // farkli user

            assertThat(n.getIsRead()).isFalse();
            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("Notification bulunamazsa sessizce cikar")
        void nonExistentNotification() {
            when(notificationRepository.findById(anyLong())).thenReturn(Optional.empty());

            service.markRead(999L, 42L);

            verify(notificationRepository, never()).save(any());
        }
    }

    @Nested @DisplayName("markAllRead()")
    class MarkAllRead {

        @Test
        @DisplayName("Repository bulk update cagrilir")
        void bulkUpdate() {
            service.markAllRead(42L);
            verify(notificationRepository).markAllReadForRecipient(42L);
        }
    }
}
