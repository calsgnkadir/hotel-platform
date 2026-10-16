package com.hotelapp.event;

import com.hotelapp.enums.NotificationType;
import com.hotelapp.service.AccountClosureService;
import com.hotelapp.service.NotificationService;
import com.hotelapp.service.OutboxService;
import com.hotelapp.service.StandbyService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Gelmedi işareti yan etkileri: Türkçe metin, otomatik banda gelecek vardiyaların boşaltılması. */
@ExtendWith(MockitoExtension.class)
class NoShowEventListenerTest {

    private static final String JARGON = "(?i)strike|no-show|hold";

    @Mock private NotificationService notificationService;
    @Mock private OutboxService outboxService;
    @Mock private StandbyService standbyService;
    @Mock private AccountClosureService accountClosureService;
    @InjectMocks private NoShowEventListener listener;

    private NoShowMarkedEvent event(boolean banned, LocalDateTime until) {
        return new NoShowMarkedEvent(11L, 33L, 7L, "aday@test.local", "Test Aday", "Garson",
                banned ? 3 : 2, banned, until, List.of(500L));
    }

    @Test
    @DisplayName("Ban yok: aday bildirimi jargonsuz, kalan hak yazılı; vardiya boşaltma çağrılmaz")
    void noBan_turkishText_noRelease() {
        listener.onNoShowMarked(event(false, null));

        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notify(eq(7L), eq(NotificationType.NO_SHOW_MARKED),
                title.capture(), msg.capture(), eq("applications"));
        assertThat(title.getValue() + " " + msg.getValue()).doesNotContainPattern(JARGON);
        assertThat(msg.getValue()).contains("kalan hakkın: 2");
        verify(accountClosureService, never()).releaseCandidate(any(), any(), any());
        verify(standbyService).offerAfterNoShow(33L, List.of(500L));
    }

    @Test
    @DisplayName("Otomatik ban: gelecek vardiyalar ban bitişine kadar boşalır, önce boşaltma sonra yedek teklifi")
    void autoBan_releasesShiftsUntilBanEnd() {
        LocalDateTime until = LocalDateTime.of(2026, 11, 15, 12, 0);
        when(accountClosureService.releaseCandidate(7L, until, AccountClosureService.Reason.SUSPENDED))
                .thenReturn(new AccountClosureService.Result(1, 2));

        listener.onNoShowMarked(event(true, until));

        InOrder order = inOrder(accountClosureService, standbyService);
        order.verify(accountClosureService).releaseCandidate(7L, until, AccountClosureService.Reason.SUSPENDED);
        order.verify(standbyService).offerAfterNoShow(33L, List.of(500L));

        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notify(eq(7L), eq(NotificationType.AUTO_BANNED),
                any(), msg.capture(), any());
        assertThat(msg.getValue()).doesNotContainPattern(JARGON).contains("2 kabul edilmiş vardiyan iptal edildi");
    }

    @Test
    @DisplayName("Boşaltma hatası bildirim ve yedek teklifini durdurmaz")
    void releaseFailure_doesNotStopSideEffects() {
        LocalDateTime until = LocalDateTime.of(2026, 11, 15, 12, 0);
        doThrow(new RuntimeException("db")).when(accountClosureService).releaseCandidate(any(), any(), any());

        listener.onNoShowMarked(event(true, until));

        verify(notificationService).notify(eq(7L), eq(NotificationType.AUTO_BANNED), any(), any(), any());
        verify(standbyService).offerAfterNoShow(33L, List.of(500L));
    }
}
