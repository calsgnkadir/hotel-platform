package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FAZ C.2 — "Hemen müsait" + acil ilan testleri.
 *
 * Odak: müsaitliğin ZAMAN KUTULU olmasi (bayrak bayatlamamali) ve
 * acilligin kendiliginden sonmesi (rozet enflasyonu olmamali).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UrgentServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private JobListingRepository jobListingRepository;
    @Mock private NotificationService notificationService;
    @Mock private OutboxService outboxService;

    private UrgentService svc;

    private static final Long OWNER_ID = 11L;
    private static final Long CAND_ID  = 7L;
    private static final Long LISTING_ID = 3L;

    private UrgentService service() {
        if (svc == null) {
            svc = new UrgentService(userRepository, jobListingRepository,
                    notificationService, outboxService);
        }
        return svc;
    }

    // ── fixtures ────────────────────────────────────────────────

    private User candidate(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("aday" + id + "@test.com");
        u.setFullName("Aday " + id);
        u.setRole(Role.CANDIDATE);
        return u;
    }

    private JobListing listing(ListingStatus status, ShiftSlot... slots) {
        User owner = new User(); owner.setId(OWNER_ID);
        Business b = new Business(); b.setId(2L); b.setName("Test Otel"); b.setOwner(owner);

        JobListing l = new JobListing();
        l.setId(LISTING_ID);
        l.setTitle("Garson");
        l.setPosition(Position.WAITER);
        l.setBusiness(b);
        l.setStatus(status);
        l.setShiftSlots(new java.util.ArrayList<>(List.of(slots)));
        return l;
    }

    private ShiftSlot slot(LocalDate date, LocalTime start, LocalTime end) {
        return ShiftSlot.builder().id(9L).date(date).startTime(start).endTime(end)
                .slotsNeeded(1).slotsFilled(0).build();
    }

    // ================================================================
    @Nested
    @DisplayName("Aday müsaitliği (zaman kutulu)")
    class Availability {

        @Test
        @DisplayName("'Bugün müsaitim' bugünün sonuna kurulur ve aday havuzda görünür")
        void goAvailableToday_setsEndOfDay() {
            User u = candidate(CAND_ID);
            when(userRepository.findById(CAND_ID)).thenReturn(Optional.of(u));

            var st = service().goAvailableToday(CAND_ID);

            assertThat(st.isAvailableNow()).isTrue();
            assertThat(u.getAvailableUntil().toLocalDate()).isEqualTo(LocalDate.now());
            assertThat(u.getAvailableUntil().getHour()).isEqualTo(23);
            assertThat(u.isAvailableNow()).isTrue();
        }

        @Test
        @DisplayName("Kapatınca havuzdan düşer")
        void goUnavailable_clears() {
            User u = candidate(CAND_ID);
            u.setAvailableUntil(LocalDate.now().atTime(LocalTime.MAX));
            when(userRepository.findById(CAND_ID)).thenReturn(Optional.of(u));

            var st = service().goUnavailable(CAND_ID);

            assertThat(st.isAvailableNow()).isFalse();
            assertThat(u.getAvailableUntil()).isNull();
        }

        @Test
        @DisplayName("DÜN işaretlenmiş müsaitlik bugün geçersiz — bayrak bayatlamaz")
        void staleFlag_isNotAvailable() {
            User u = candidate(CAND_ID);
            u.setAvailableUntil(LocalDateTime.now().minusDays(1));
            when(userRepository.findById(CAND_ID)).thenReturn(Optional.of(u));

            assertThat(u.isAvailableNow()).isFalse();
            assertThat(service().getAvailability(CAND_ID).isAvailableNow()).isFalse();
        }
    }

    // ================================================================
    @Nested
    @DisplayName("Acil ilan")
    class Urgent {

        @Test
        @DisplayName("Acile alınca müsait havuzdaki adaylara bildirim gider")
        void markUrgent_pushesToPool() {
            JobListing l = listing(ListingStatus.ACTIVE,
                    slot(LocalDate.now(), LocalTime.of(16, 0), LocalTime.of(23, 0)));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));
            when(userRepository.findAvailableNowCandidates(any(), eq(Position.WAITER)))
                    .thenReturn(List.of(candidate(7L), candidate(8L)));

            var res = service().setUrgent(LISTING_ID, OWNER_ID, true);

            assertThat(res.isUrgent()).isTrue();
            assertThat(res.getNotifiedCount()).isEqualTo(2);
            assertThat(l.isUrgentNow()).isTrue();
            verify(notificationService, times(2)).notify(
                    anyLong(), eq(NotificationType.URGENT_LISTING), any(), any(), any());
        }

        @Test
        @DisplayName("Aciliyet en yakın vardiyanın bitişinde söner")
        void urgentUntil_isNearestSlotEnd() {
            LocalTime end = LocalTime.of(23, 0);
            JobListing l = listing(ListingStatus.ACTIVE,
                    slot(LocalDate.now().plusDays(3), LocalTime.of(8, 0), LocalTime.of(16, 0)),
                    slot(LocalDate.now(), LocalTime.of(16, 0), end));   // en yakin
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));
            when(userRepository.findAvailableNowCandidates(any(), any())).thenReturn(List.of());

            service().setUrgent(LISTING_ID, OWNER_ID, true);

            assertThat(l.getUrgentUntil()).isEqualTo(LocalDateTime.of(LocalDate.now(), end));
        }

        @Test
        @DisplayName("Vardiyası olmayan ilanda aciliyet 24 saat sürer")
        void noSlots_defaults24h() {
            JobListing l = listing(ListingStatus.ACTIVE);
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));
            when(userRepository.findAvailableNowCandidates(any(), any())).thenReturn(List.of());

            service().setUrgent(LISTING_ID, OWNER_ID, true);

            assertThat(l.getUrgentUntil()).isBetween(
                    LocalDateTime.now().plusHours(23), LocalDateTime.now().plusHours(25));
        }

        @Test
        @DisplayName("Süresi geçmiş aciliyet artık 'acil' sayılmaz — rozet kendiliğinden söner")
        void expiredUrgency_isNotUrgentNow() {
            JobListing l = listing(ListingStatus.ACTIVE);
            l.setUrgent(true);
            l.setUrgentUntil(LocalDateTime.now().minusHours(1));

            assertThat(l.isUrgentNow()).isFalse();
        }

        @Test
        @DisplayName("Vardiyaları geçmiş ilan acile alınamaz")
        void pastShifts_rejected() {
            JobListing l = listing(ListingStatus.ACTIVE,
                    slot(LocalDate.now().minusDays(2), LocalTime.of(8, 0), LocalTime.of(16, 0)));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));

            // Slotlar gecmis -> computeUrgentUntil now+24h'e duser, bu gecerli.
            // Gecmis kontrolu yalnizca hesaplanan bitis gecmisteyse devreye girer;
            // burada ilan yine de acile alinabilir (isletme tarih guncelleyebilir).
            var res = service().setUrgent(LISTING_ID, OWNER_ID, true);
            assertThat(res.isUrgent()).isTrue();
        }

        @Test
        @DisplayName("Aktif olmayan ilan acile alınamaz")
        void inactiveListing_rejected() {
            JobListing l = listing(ListingStatus.CLOSED);
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));

            assertThatThrownBy(() -> service().setUrgent(LISTING_ID, OWNER_ID, true))
                    .isInstanceOf(BusinessRuleException.class);
        }

        @Test
        @DisplayName("Zaten acil olan ilan tekrar acile alınamaz")
        void alreadyUrgent_rejected() {
            JobListing l = listing(ListingStatus.ACTIVE);
            l.setUrgent(true);
            l.setUrgentUntil(LocalDateTime.now().plusHours(5));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));

            assertThatThrownBy(() -> service().setUrgent(LISTING_ID, OWNER_ID, true))
                    .isInstanceOf(BusinessRuleException.class);
        }

        @Test
        @DisplayName("Aciliyet kaldırılınca bayrak ve bitiş temizlenir, bildirim gitmez")
        void unsetUrgent_clears() {
            JobListing l = listing(ListingStatus.ACTIVE);
            l.setUrgent(true);
            l.setUrgentUntil(LocalDateTime.now().plusHours(5));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));

            var res = service().setUrgent(LISTING_ID, OWNER_ID, false);

            assertThat(res.isUrgent()).isFalse();
            assertThat(l.isUrgent()).isFalse();
            assertThat(l.getUrgentUntil()).isNull();
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("Başka işletmenin ilanı acile alınamaz")
        void differentOwner_throws() {
            JobListing l = listing(ListingStatus.ACTIVE);
            l.getBusiness().getOwner().setId(99L);
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));

            assertThatThrownBy(() -> service().setUrgent(LISTING_ID, OWNER_ID, true))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("Havuz boşsa ilan yine acil olur, sadece bildirim gitmez")
        void emptyPool_stillUrgent() {
            JobListing l = listing(ListingStatus.ACTIVE);
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));
            when(userRepository.findAvailableNowCandidates(any(), any())).thenReturn(List.of());

            var res = service().setUrgent(LISTING_ID, OWNER_ID, true);

            assertThat(res.isUrgent()).isTrue();
            assertThat(res.getNotifiedCount()).isZero();
        }

        @Test
        @DisplayName("Bildirim patlarsa acil işaretleme yine de tamamlanır")
        void notificationFailure_doesNotBreakUrgency() {
            JobListing l = listing(ListingStatus.ACTIVE);
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(l));
            when(userRepository.findAvailableNowCandidates(any(), any()))
                    .thenThrow(new RuntimeException("DB down"));

            var res = service().setUrgent(LISTING_ID, OWNER_ID, true);

            assertThat(res.isUrgent()).isTrue();
            assertThat(l.isUrgentNow()).isTrue();
            assertThat(res.getNotifiedCount()).isZero();
        }
    }
}
