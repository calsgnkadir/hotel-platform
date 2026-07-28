package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.ApplicationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FAZ C.3 — SGK işe giriş bildirgesi hatırlatıcısı testleri.
 * Odak: idempotency (tek hatirlatma) + owner'a dogru bildirim + bir basvurunun
 * hatasinin digerlerini engellememesi.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SgkReminderServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private NotificationService notificationService;
    @Mock private OutboxService outboxService;

    private SgkReminderService svc;
    private SgkReminderService service() {
        if (svc == null) svc = new SgkReminderService(applicationRepository, notificationService, outboxService);
        return svc;
    }

    private static final Long OWNER_ID = 11L;

    private Application app(Long id, Long ownerId) {
        User owner = new User(); owner.setId(ownerId);
        Business b = new Business(); b.setId(2L); b.setName("Otel"); b.setOwner(owner);
        JobListing l = new JobListing(); l.setId(3L); l.setTitle("Garson"); l.setBusiness(b);

        User cand = new User(); cand.setId(7L); cand.setFullName("Aday 7");
        ShiftSlot s = ShiftSlot.builder().id(9L)
                .date(LocalDate.now()).startTime(LocalTime.of(16, 0)).endTime(LocalTime.of(23, 0))
                .slotsNeeded(1).slotsFilled(1).build();

        return Application.builder().id(id).status(ApplicationStatus.ACCEPTED)
                .candidate(cand).jobListing(l).requestedSlots(Set.of(s)).build();
    }

    @Test
    @DisplayName("Vardiyasi yaklasan basvuruya hatirlatma gider ve sgkReminderSentAt set edilir")
    void sendsAndMarks() {
        Application a = app(1L, OWNER_ID);
        when(applicationRepository.findAcceptedNeedingSgkReminder(any(), any()))
                .thenReturn(List.of(a));

        int n = service().sendDueReminders();

        assertThat(n).isEqualTo(1);
        assertThat(a.getSgkReminderSentAt()).isNotNull();
        verify(notificationService).notify(eq(OWNER_ID),
                eq(NotificationType.SGK_REMINDER), any(), any(), eq("applications"));
        verify(applicationRepository).save(a);
    }

    @Test
    @DisplayName("Uygun başvuru yoksa 0 döner, bildirim gitmez")
    void noneDue() {
        when(applicationRepository.findAcceptedNeedingSgkReminder(any(), any()))
                .thenReturn(List.of());

        assertThat(service().sendDueReminders()).isZero();
        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("Bir başvurunun hatası diğerlerini durdurmaz (idempotency korunur)")
    void oneFailureDoesNotBlockOthers() {
        Application ok = app(1L, OWNER_ID);
        Application bad = app(2L, 99L);
        when(applicationRepository.findAcceptedNeedingSgkReminder(any(), any()))
                .thenReturn(List.of(bad, ok));
        // bad -> bildirim patlar
        doThrow(new RuntimeException("push fail"))
                .when(notificationService).notify(eq(99L), any(), any(), any(), any());

        int n = service().sendDueReminders();

        assertThat(n).isEqualTo(1);                       // sadece ok gonderildi
        assertThat(ok.getSgkReminderSentAt()).isNotNull();
        assertThat(bad.getSgkReminderSentAt()).isNull();  // patlayan tekrar denenebilir
    }

    @Test
    @DisplayName("Sorgu bugün..yarın aralığıyla çağrılır")
    void queriesTodayToTomorrow() {
        when(applicationRepository.findAcceptedNeedingSgkReminder(any(), any()))
                .thenReturn(List.of());

        service().sendDueReminders();

        verify(applicationRepository).findAcceptedNeedingSgkReminder(
                eq(LocalDate.now()), eq(LocalDate.now().plusDays(1)));
    }
}
