package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.SavedSearch;
import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.SavedSearchRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * FAZ 6 — SavedSearchService test coverage.
 *
 * Kritik business logic'i mock'lu unit test ile dogruluyor:
 *  - create(): kullanici basina max 20 kayit, blank name red, sahip atamasi
 *  - update()/delete(): ownership kontrolu (baska kullanicinin araması silinemez)
 *  - notifyNewMatches(): matcher happy path + edge cases (bildirim kapali, silinmis
 *    saved search, bos matches -> lastNotifiedAt guncellemez, notification icerigi)
 */
@ExtendWith(MockitoExtension.class)
class SavedSearchServiceTest {

    @Mock private SavedSearchRepository repo;
    @Mock private UserRepository userRepository;
    @Mock private JobListingQueryService listingQueryService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private SavedSearchService service;

    private static final Long USER_ID = 42L;
    private static final Long SAVED_ID = 100L;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(USER_ID);
    }

    /* ── Yardimci factory ── */

    private SavedSearch savedSearch(String name, boolean notifEnabled, LocalDateTime lastNotified, LocalDateTime created) {
        SavedSearch s = SavedSearch.builder()
                .id(SAVED_ID)
                .user(owner)
                .name(name)
                .notificationsEnabled(notifEnabled)
                .lastNotifiedAt(lastNotified)
                .build();
        s.setCreatedAt(created);
        return s;
    }

    private JobListing listing(Long id, String title) {
        JobListing l = new JobListing();
        l.setId(id);
        l.setTitle(title);
        return l;
    }

    /* ═══════════════════════════════════════════════════════════════════ */
    /*                              CREATE                                  */
    /* ═══════════════════════════════════════════════════════════════════ */

    @Nested @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("MAX_PER_USER limit asilirsa BusinessRuleException atar")
        void maxLimit() {
            when(repo.countByUser_Id(USER_ID)).thenReturn((long) SavedSearchService.MAX_PER_USER);

            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder()
                    .name("Test")
                    .build();

            assertThatThrownBy(() -> service.create(USER_ID, p))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("En fazla");
            verify(repo, never()).save(any());
        }

        @Test
        @DisplayName("Blank isim BusinessRuleException atar")
        void blankName() {
            when(repo.countByUser_Id(USER_ID)).thenReturn(0L);
            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder()
                    .name("   ")
                    .build();
            assertThatThrownBy(() -> service.create(USER_ID, p))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Arama adı");
        }

        @Test
        @DisplayName("Null isim BusinessRuleException atar")
        void nullName() {
            when(repo.countByUser_Id(USER_ID)).thenReturn(0L);
            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder().build();
            assertThatThrownBy(() -> service.create(USER_ID, p))
                    .isInstanceOf(BusinessRuleException.class);
        }

        @Test
        @DisplayName("User bulunamazsa ResourceNotFoundException")
        void userNotFound() {
            when(repo.countByUser_Id(USER_ID)).thenReturn(5L);
            when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder()
                    .name("Test").build();
            assertThatThrownBy(() -> service.create(USER_ID, p))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("Happy path — lastNotifiedAt now ile init (backfill patlamasin)")
        void happyPath() {
            when(repo.countByUser_Id(USER_ID)).thenReturn(3L);
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(owner));
            when(repo.save(any(SavedSearch.class))).thenAnswer(inv -> inv.getArgument(0));

            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder()
                    .name("Besiktas Garson")
                    .position(Position.WAITER)
                    .district("Besiktas")
                    .shifts(Set.of(Shift.EVENING))
                    .build();

            LocalDateTime before = LocalDateTime.now().minusSeconds(1);
            SavedSearch saved = service.create(USER_ID, p);
            LocalDateTime after = LocalDateTime.now().plusSeconds(1);

            assertThat(saved.getName()).isEqualTo("Besiktas Garson");
            assertThat(saved.getUser()).isSameAs(owner);
            assertThat(saved.getPosition()).isEqualTo(Position.WAITER);
            assertThat(saved.getDistrict()).isEqualTo("Besiktas");
            assertThat(saved.getShifts()).containsExactly(Shift.EVENING);
            assertThat(saved.isNotificationsEnabled()).isTrue();
            // lastNotifiedAt yaklasik now olmali — eski ilanlar backfill notification uretmesin
            assertThat(saved.getLastNotifiedAt()).isBetween(before, after);
        }

        @Test
        @DisplayName("blank district/keyword null'a normalize edilir")
        void blankNormalizedToNull() {
            when(repo.countByUser_Id(USER_ID)).thenReturn(0L);
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(owner));
            when(repo.save(any(SavedSearch.class))).thenAnswer(inv -> inv.getArgument(0));

            SavedSearchService.CreatePayload p = SavedSearchService.CreatePayload.builder()
                    .name("Test")
                    .district("   ")
                    .keyword("")
                    .build();
            SavedSearch saved = service.create(USER_ID, p);
            assertThat(saved.getDistrict()).isNull();
            assertThat(saved.getKeyword()).isNull();
        }
    }

    /* ═══════════════════════════════════════════════════════════════════ */
    /*                         OWNERSHIP (update/delete)                    */
    /* ═══════════════════════════════════════════════════════════════════ */

    @Nested @DisplayName("update() / delete() ownership")
    class Ownership {

        @Test
        @DisplayName("Baska kullanicinin aramasi update edilemez -> ResourceNotFoundException")
        void updateForeignThrows() {
            SavedSearch someoneElse = savedSearch("Baskasi", true, null, LocalDateTime.now());
            User otherUser = new User();
            otherUser.setId(999L);
            someoneElse.setUser(otherUser);
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(someoneElse));

            SavedSearchService.UpdatePayload p = new SavedSearchService.UpdatePayload();
            p.setName("Yeni isim");
            assertThatThrownBy(() -> service.update(USER_ID, SAVED_ID, p))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("Baska kullanicinin aramasi delete edilemez")
        void deleteForeignThrows() {
            SavedSearch someoneElse = savedSearch("Baskasi", true, null, LocalDateTime.now());
            User otherUser = new User();
            otherUser.setId(999L);
            someoneElse.setUser(otherUser);
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(someoneElse));

            assertThatThrownBy(() -> service.delete(USER_ID, SAVED_ID))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(repo, never()).delete(any());
        }

        @Test
        @DisplayName("Kendi araması update edilebilir")
        void updateOwnedOk() {
            SavedSearch mine = savedSearch("Eski isim", true, null, LocalDateTime.now());
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(mine));

            SavedSearchService.UpdatePayload p = new SavedSearchService.UpdatePayload();
            p.setName("Yeni isim");
            p.setNotificationsEnabled(false);
            SavedSearch updated = service.update(USER_ID, SAVED_ID, p);

            assertThat(updated.getName()).isEqualTo("Yeni isim");
            assertThat(updated.isNotificationsEnabled()).isFalse();
        }
    }

    /* ═══════════════════════════════════════════════════════════════════ */
    /*                        notifyNewMatches                              */
    /* ═══════════════════════════════════════════════════════════════════ */

    @Nested @DisplayName("notifyNewMatches()")
    class NotifyMatches {

        @Test
        @DisplayName("Silinmis (findById empty) -> 0, notification atmaz")
        void deletedReturnsZero() {
            when(repo.findById(SAVED_ID)).thenReturn(Optional.empty());
            int n = service.notifyNewMatches(SAVED_ID);
            assertThat(n).isZero();
            verifyNoInteractions(notificationService, listingQueryService);
        }

        @Test
        @DisplayName("notificationsEnabled=false -> 0, matcher cagirilmaz")
        void notificationsOff() {
            SavedSearch s = savedSearch("X", false, null, LocalDateTime.now());
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));

            int n = service.notifyNewMatches(SAVED_ID);
            assertThat(n).isZero();
            verifyNoInteractions(notificationService, listingQueryService);
        }

        @Test
        @DisplayName("since = lastNotifiedAt varsa onu kullanir")
        void sinceUsesLastNotifiedAt() {
            LocalDateTime lastNotified = LocalDateTime.of(2026, 6, 15, 10, 0);
            LocalDateTime created = LocalDateTime.of(2026, 6, 1, 10, 0);
            SavedSearch s = savedSearch("X", true, lastNotified, created);
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            service.notifyNewMatches(SAVED_ID);

            ArgumentCaptor<LocalDateTime> sinceCap = ArgumentCaptor.forClass(LocalDateTime.class);
            verify(listingQueryService).findActiveSince(
                    sinceCap.capture(), any(), any(), any(), any(), any(), any(), any(), any()
            );
            assertThat(sinceCap.getValue()).isEqualTo(lastNotified);
        }

        @Test
        @DisplayName("since = createdAt fallback (hic notify edilmemis)")
        void sinceFallbackToCreatedAt() {
            LocalDateTime created = LocalDateTime.of(2026, 6, 1, 10, 0);
            SavedSearch s = savedSearch("X", true, null, created);
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            service.notifyNewMatches(SAVED_ID);

            ArgumentCaptor<LocalDateTime> sinceCap = ArgumentCaptor.forClass(LocalDateTime.class);
            verify(listingQueryService).findActiveSince(
                    sinceCap.capture(), any(), any(), any(), any(), any(), any(), any(), any()
            );
            assertThat(sinceCap.getValue()).isEqualTo(created);
        }

        @Test
        @DisplayName("Bos matches -> 0 doner, notification yok, lastNotifiedAt DOKUNULMAZ")
        void emptyMatchesDoesNotUpdateLastNotifiedAt() {
            LocalDateTime originalLastNotified = LocalDateTime.of(2026, 6, 15, 10, 0);
            SavedSearch s = savedSearch("X", true, originalLastNotified, LocalDateTime.now());
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            int n = service.notifyNewMatches(SAVED_ID);
            assertThat(n).isZero();
            verifyNoInteractions(notificationService);
            // lastNotifiedAt korunur (backfill window'i acik kalsin)
            assertThat(s.getLastNotifiedAt()).isEqualTo(originalLastNotified);
        }

        @Test
        @DisplayName("Tek eslesme -> notify + count 1 + lastNotifiedAt guncellenir")
        void singleMatchNotifies() {
            SavedSearch s = savedSearch("Besiktas Garson", true, LocalDateTime.now().minusHours(1), LocalDateTime.now().minusDays(1));
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of(listing(50L, "Cumartesi garson")));

            LocalDateTime before = LocalDateTime.now().minusSeconds(1);
            int n = service.notifyNewMatches(SAVED_ID);
            LocalDateTime after = LocalDateTime.now().plusSeconds(1);

            assertThat(n).isEqualTo(1);

            ArgumentCaptor<String> titleCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> linkCap = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notify(
                    eq(USER_ID),
                    eq(NotificationType.MATCHING_LISTING),
                    titleCap.capture(),
                    msgCap.capture(),
                    linkCap.capture()
            );
            assertThat(titleCap.getValue()).contains("Besiktas Garson");
            assertThat(msgCap.getValue()).isEqualTo("Cumartesi garson");
            assertThat(linkCap.getValue()).isEqualTo("/listings/50");

            // lastNotifiedAt now'a set edilmis
            assertThat(s.getLastNotifiedAt()).isBetween(before, after);
        }

        @Test
        @DisplayName("Coklu eslesme -> mesaj 'ilkTitle ve N-1 yeni ilan daha' formati")
        void multipleMatchesAggregateMessage() {
            SavedSearch s = savedSearch("Test", true, LocalDateTime.now().minusHours(1), LocalDateTime.now().minusDays(1));
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of(
                            listing(11L, "Ilan A"),
                            listing(22L, "Ilan B"),
                            listing(33L, "Ilan C")
                    ));

            int n = service.notifyNewMatches(SAVED_ID);
            assertThat(n).isEqualTo(3);

            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> linkCap = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notify(
                    anyLong(),
                    eq(NotificationType.MATCHING_LISTING),
                    any(),
                    msgCap.capture(),
                    linkCap.capture()
            );
            assertThat(msgCap.getValue()).isEqualTo("Ilan A ve 2 yeni ilan daha");
            assertThat(linkCap.getValue()).isEqualTo("/listings/11");   // ilkine link
        }

        @Test
        @DisplayName("Bos shift set -> shifts parametresi null olarak query'ye geçer")
        @SuppressWarnings("unchecked")
        void emptyShiftsPassedAsNull() {
            SavedSearch s = savedSearch("Test", true, LocalDateTime.now().minusHours(1), LocalDateTime.now().minusDays(1));
            s.setShifts(new HashSet<>());
            when(repo.findById(SAVED_ID)).thenReturn(Optional.of(s));
            when(listingQueryService.findActiveSince(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            service.notifyNewMatches(SAVED_ID);

            ArgumentCaptor<List<Shift>> shiftsCap = ArgumentCaptor.forClass(List.class);
            verify(listingQueryService).findActiveSince(
                    any(LocalDateTime.class),
                    any(),
                    any(),
                    shiftsCap.capture(),
                    any(),
                    any(),
                    any(),
                    any(),
                    any()
            );
            assertThat(shiftsCap.getValue()).isNull();
        }
    }
}
