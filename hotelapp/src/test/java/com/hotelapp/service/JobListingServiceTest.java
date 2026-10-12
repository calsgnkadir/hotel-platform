package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessPhotoRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserAvailabilityBlockRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobListingServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private BusinessRepository businessRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private BusinessPhotoRepository businessPhotoRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private UserAvailabilityBlockRepository availabilityBlockRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;
    @Mock private BillingService billingService;

    @InjectMocks
    private JobListingService service;

    private static final Long OWNER_ID = 11L;
    private static final Long OTHER_ID = 22L;

    private Business businessOwnedBy(Long ownerId) {
        User owner = new User();
        owner.setId(ownerId);
        Business b = new Business();
        b.setId(100L);
        b.setOwner(owner);
        b.setDistrict("Beyoğlu");
        b.setName("Test Hotel");
        return b;
    }

    private ListingRequest validRequest() {
        ListingRequest r = new ListingRequest();
        r.setPosition(Position.WAITER);
        r.setJobType(JobType.PERMANENT);
        r.setTitle("Garson");
        r.setDescription("Hafta sonu garson aranıyor");
        r.setShiftSlots(List.of(slot(LocalDate.now().plusDays(2), "10:00", "18:00", 1)));
        return r;
    }

    private ShiftSlotCreate slot(LocalDate date, String start, String end, Integer needed) {
        ShiftSlotCreate s = new ShiftSlotCreate();
        s.setDate(date);
        s.setStartTime(LocalTime.parse(start));
        s.setEndTime(LocalTime.parse(end));
        s.setSlotsNeeded(needed);
        return s;
    }

    // ============================================================
    @Nested
    @DisplayName("updateListing — slot silme koruması (FK ihlali engeli)")
    class UpdateListingSlotGuard {

        @Test
        @DisplayName("Başvurusu olan slot silinmeye çalışılırsa BusinessRuleException, save çağrılmaz")
        void removingSlotWithApplications_throws() {
            // Mevcut ilan: id=100 slotu var, sahibi OWNER_ID
            JobListing listing = JobListing.builder()
                    .id(5L)
                    .business(businessOwnedBy(OWNER_ID))
                    .position(Position.WAITER)
                    .jobType(JobType.PERMANENT)
                    .title("Garson")
                    .status(ListingStatus.ACTIVE)
                    .build();
            listing.setShiftSlots(new java.util.ArrayList<>());   // @Builder.Default'a bagimli kalma
            ShiftSlot existing = ShiftSlot.builder()
                    .id(100L)
                    .jobListing(listing)
                    .date(LocalDate.now().plusDays(2))
                    .startTime(LocalTime.parse("10:00"))
                    .endTime(LocalTime.parse("18:00"))
                    .slotsNeeded(1)
                    .slotsFilled(0)
                    .build();
            listing.getShiftSlots().add(existing);

            when(jobListingRepository.findById(5L)).thenReturn(Optional.of(listing));
            // Request'te id=100 YOK (yeni slot) -> silinmek isteniyor; ve o slota basvuru var
            when(applicationRepository.existsByRequestedSlots_Id(100L)).thenReturn(true);

            assertThatThrownBy(() -> service.updateListing(5L, OWNER_ID, validRequest()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Başvuru alınmış");

            // Slot silinmemis, save cagrilmamis olmali (mutasyon guard'dan once bloklandi)
            assertThat(listing.getShiftSlots()).contains(existing);
            verify(jobListingRepository, never()).save(any());
        }
    }

    // ============================================================
    @Nested
    @DisplayName("createListing — validation + ownership")
    class CreateListing {

        @Test
        @DisplayName("Business profili yoksa BusinessRuleException")
        void noBusiness_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createListing(OWNER_ID, validRequest()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.business.profileNotFound");
        }

        @Test
        @DisplayName("Bos slot listesi -> BusinessRuleException")
        void emptySlots_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setShiftSlots(List.of());

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.listing.slotRequired");
        }

        @Test
        @DisplayName("Slot gecmis tarih -> BusinessRuleException")
        void slotInPast_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setShiftSlots(List.of(slot(LocalDate.now().minusDays(1), "10:00", "18:00", 1)));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("geçmiş tarih olamaz");
        }

        @Test
        @DisplayName("Slot endTime == startTime -> BusinessRuleException")
        void slotInvalidTimes_throws() {
            // Eskiden 18:00-10:00 de reddediliyordu; artik gece vardiyasi (ertesi gun biter).
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setShiftSlots(List.of(slot(LocalDate.now().plusDays(3), "18:00", "18:00", 1)));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("bitiş saati başlangıç saatiyle aynı olamaz");
        }

        @Test
        @DisplayName("Gece vardiyası 22:00-06:00 geçerli (ertesi gün biter)")
        void overnightSlot_isValid() {
            org.springframework.test.util.ReflectionTestUtils.invokeMethod(service, "validateSlots",
                    List.of(slot(LocalDate.now().plusDays(3), "22:00", "06:00", 2)));
        }

        @Test
        @DisplayName("16 saati aşan vardiya (gündüz ya da gece) reddedilir")
        void tooLongSlot_throws() {
            assertThatThrownBy(() -> org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,
                    "validateSlots", List.of(slot(LocalDate.now().plusDays(3), "20:00", "13:00", 1))))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("en fazla 16 saat");
            assertThatThrownBy(() -> org.springframework.test.util.ReflectionTestUtils.invokeMethod(service,
                    "validateSlots", List.of(slot(LocalDate.now().plusDays(3), "06:00", "23:00", 1))))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("en fazla 16 saat");
        }

        @Test
        @DisplayName("Slot slotsNeeded < 1 -> BusinessRuleException")
        void slotZeroNeeded_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setShiftSlots(List.of(slot(LocalDate.now().plusDays(3), "10:00", "18:00", 0)));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("ihtiyaç sayısı en az 1");
        }

        // Maas alanlarinda backend validation yoktu: frontend bypass edilerek
        // negatif maas / salaryMin > salaryMax gonderilebiliyordu. Para state'ini
        // mutasyona ugratan tek yer burasi oldugu icin sunucuda kapatildi.
        @Test
        @DisplayName("Negatif salaryMin -> BusinessRuleException")
        void negativeSalary_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setSalaryMin(new java.math.BigDecimal("-100"));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("negatif olamaz");
        }

        @Test
        @DisplayName("salaryMax < salaryMin -> BusinessRuleException")
        void maxBelowMin_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setSalaryMin(new java.math.BigDecimal("2000"));
            r.setSalaryMax(new java.math.BigDecimal("1000"));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("küçük olamaz");
        }

        @Test
        @DisplayName("endDate < startDate -> BusinessRuleException")
        void endBeforeStart_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setStartDate(LocalDate.now().plusDays(10));
            r.setEndDate(LocalDate.now().plusDays(5));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Bitiş tarihi başlangıçtan önce olamaz");
        }
    }

    // ============================================================
    @Nested
    @DisplayName("updateStatus — ownership kontrolu")
    class UpdateStatus {

        @Test
        @DisplayName("Baska kullanicinin ilani -> UnauthorizedException")
        void notOwner_throws() {
            JobListing l = JobListing.builder()
                    .business(businessOwnedBy(OWNER_ID))
                    .status(ListingStatus.ACTIVE)
                    .build();
            l.setId(42L);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            assertThatThrownBy(() -> service.updateStatus(42L, OTHER_ID, ListingStatus.PAUSED))
                    .isInstanceOf(UnauthorizedException.class)
                    .hasMessageContaining("error.listing.notOwner");
        }

        @Test
        @DisplayName("Kapatinca ekip listesi olayi yayinlanir (bir kez)")
        void closing_publishes_roster_event_once() {
            Business biz = businessOwnedBy(OWNER_ID);
            biz.setType(com.hotelapp.enums.BusinessType.HOTEL);
            JobListing l = JobListing.builder()
                    .business(biz)
                    .position(Position.WAITER)
                    .jobType(JobType.DAILY)
                    .title("Garson")
                    .status(ListingStatus.ACTIVE)
                    .build();
            l.setId(42L);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            service.updateStatus(42L, OWNER_ID, ListingStatus.CLOSED);
            verify(eventPublisher).publishEvent(new com.hotelapp.event.ListingClosedEvent(42L));

            // Zaten kapaliyken tekrar kapatmak yeni e-posta tetiklemez
            service.updateStatus(42L, OWNER_ID, ListingStatus.CLOSED);
            verify(eventPublisher, org.mockito.Mockito.times(1)).publishEvent(any(Object.class));
        }

        @Test
        @DisplayName("Duraklatma ekip listesi tetiklemez")
        void pausing_does_not_publish() {
            Business biz = businessOwnedBy(OWNER_ID);
            biz.setType(com.hotelapp.enums.BusinessType.HOTEL);
            JobListing l = JobListing.builder()
                    .business(biz)
                    .position(Position.WAITER)
                    .jobType(JobType.DAILY)
                    .title("Garson")
                    .status(ListingStatus.ACTIVE)
                    .build();
            l.setId(42L);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            service.updateStatus(42L, OWNER_ID, ListingStatus.PAUSED);
            verify(eventPublisher, never()).publishEvent(any(Object.class));
        }
        private JobListing closedListing() {
            Business biz = businessOwnedBy(OWNER_ID);
            biz.setType(com.hotelapp.enums.BusinessType.HOTEL);
            JobListing l = JobListing.builder()
                    .business(biz)
                    .position(Position.WAITER)
                    .jobType(JobType.DAILY)
                    .title("Garson")
                    .status(ListingStatus.CLOSED)
                    .build();
            l.setId(42L);
            return l;
        }

        @Test
        @DisplayName("Kapali ilani yeniden acmak kota doluyken reddedilir, ilan kapali kalir")
        void reopening_closed_listing_without_quota_is_refused() {
            JobListing l = closedListing();
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));
            when(billingService.canCreateListingByBusiness(100L)).thenReturn(false);
            when(billingService.getFreeListings()).thenReturn(5);

            assertThatThrownBy(() -> service.updateStatus(42L, OWNER_ID, ListingStatus.ACTIVE))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Ücretsiz 5 ilan hakkını kullandın");
            assertThat(l.getStatus()).isEqualTo(ListingStatus.CLOSED);
            verify(jobListingRepository, never()).save(any());
        }

        @Test
        @DisplayName("Kapali ilani yeniden acmak kota varken serbest")
        void reopening_closed_listing_with_quota_is_allowed() {
            JobListing l = closedListing();
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));
            when(billingService.canCreateListingByBusiness(100L)).thenReturn(true);

            service.updateStatus(42L, OWNER_ID, ListingStatus.ACTIVE);
            assertThat(l.getStatus()).isEqualTo(ListingStatus.ACTIVE);
            verify(jobListingRepository).save(l);
        }

        @Test
        @DisplayName("Acik ilani duraklatmak/kapatmak kota kontrolu yapmaz")
        void non_reopening_transitions_skip_quota() {
            JobListing l = closedListing();
            l.setStatus(ListingStatus.ACTIVE);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            service.updateStatus(42L, OWNER_ID, ListingStatus.PAUSED);
            service.updateStatus(42L, OWNER_ID, ListingStatus.CLOSED);
            service.updateStatus(42L, OWNER_ID, ListingStatus.CLOSED);
            verify(billingService, never()).canCreateListingByBusiness(any());
        }

        @Test
        @DisplayName("Admin askiya aldigi ilani isletme ACTIVE yapamaz (422), ilan degismez")
        void adminSuspended_listing_cannot_be_activated_by_owner() {
            JobListing l = closedListing();
            l.setStatus(ListingStatus.PAUSED);
            l.setAdminSuspended(true);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            assertThatThrownBy(() -> service.updateStatus(42L, OWNER_ID, ListingStatus.ACTIVE))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("yönetici tarafından askıya alındı");
            assertThat(l.getStatus()).isEqualTo(ListingStatus.PAUSED);
            assertThat(l.isAdminSuspended()).isTrue();
            verify(jobListingRepository, never()).save(any());
        }

        @Test
        @DisplayName("Admin askisindaki ilani isletme kapatabilir; bayrak kalir")
        void adminSuspended_listing_can_be_closed_by_owner() {
            JobListing l = closedListing();
            l.setStatus(ListingStatus.PAUSED);
            l.setAdminSuspended(true);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));

            service.updateStatus(42L, OWNER_ID, ListingStatus.CLOSED);
            assertThat(l.getStatus()).isEqualTo(ListingStatus.CLOSED);
            assertThat(l.isAdminSuspended()).isTrue();
        }

        @Test
        @DisplayName("PAUSED -> ACTIVE kota asiliyken reddedilir")
        void resuming_paused_listing_over_quota_is_refused() {
            JobListing l = closedListing();
            l.setStatus(ListingStatus.PAUSED);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));
            when(billingService.canActivateCountedListing(100L)).thenReturn(false);
            when(billingService.getFreeListings()).thenReturn(5);

            assertThatThrownBy(() -> service.updateStatus(42L, OWNER_ID, ListingStatus.ACTIVE))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Ücretsiz 5 ilan hakkını aştın");
            assertThat(l.getStatus()).isEqualTo(ListingStatus.PAUSED);
            verify(jobListingRepository, never()).save(any());
        }

        @Test
        @DisplayName("PAUSED -> ACTIVE kota icindeyken serbest (yeni-ilan kapisi kullanilmaz)")
        void resuming_paused_listing_within_quota_is_allowed() {
            JobListing l = closedListing();
            l.setStatus(ListingStatus.PAUSED);
            when(jobListingRepository.findById(42L)).thenReturn(Optional.of(l));
            when(billingService.canActivateCountedListing(100L)).thenReturn(true);

            service.updateStatus(42L, OWNER_ID, ListingStatus.ACTIVE);
            assertThat(l.getStatus()).isEqualTo(ListingStatus.ACTIVE);
            verify(billingService, never()).canCreateListingByBusiness(any());
        }
    }

    // ============================================================
    @Nested
    @DisplayName("Müsaitlik eşleşmesi — gece bloğu ve gün kaydırması")
    class AvailabilityFit {

        // 2026-10-12 Pazartesi
        private final LocalDate MON = LocalDate.of(2026, 10, 12);

        private com.hotelapp.entity.UserAvailabilityBlock block(java.time.DayOfWeek d, String s, String e) {
            return com.hotelapp.entity.UserAvailabilityBlock.builder()
                    .dayOfWeek(d).startTime(LocalTime.parse(s)).endTime(LocalTime.parse(e)).build();
        }

        private boolean fits(List<com.hotelapp.entity.UserAvailabilityBlock> blocks,
                             LocalDate date, String start, String end) {
            when(availabilityBlockRepository.findByUserIdOrderByDayOfWeekAscStartTimeAsc(7L)).thenReturn(blocks);
            JobListing l = JobListing.builder().id(1L).build();
            l.setShiftSlots(new java.util.ArrayList<>(List.of(ShiftSlot.builder().id(1L).date(date)
                    .startTime(LocalTime.parse(start)).endTime(LocalTime.parse(end)).build())));
            return service.candidateFitsListingSlots(7L, l);
        }

        @Test
        @DisplayName("Pzt 22:00–06:00 bloğu: aynı gece 23:00–05:00 ve ertesi sabah 04:00–06:00 vardiyasını kapsar")
        void nightBlock_coversNightAndNextMorning() {
            var night = List.of(block(java.time.DayOfWeek.MONDAY, "22:00", "06:00"));
            assertThat(fits(night, MON, "23:00", "05:00")).isTrue();
            assertThat(fits(night, MON.plusDays(1), "04:00", "06:00")).isTrue();
            assertThat(fits(night, MON.plusDays(1), "00:00", "06:00")).isTrue();   // gün kaydırması
            assertThat(fits(night, MON, "22:00", "06:00")).isTrue();
        }

        @Test
        @DisplayName("Gece bloğu dışına taşan vardiya ve yanlış gün eşleşmez")
        void nightBlock_rejectsOutside() {
            var night = List.of(block(java.time.DayOfWeek.MONDAY, "22:00", "06:00"));
            assertThat(fits(night, MON, "21:00", "05:00")).isFalse();
            assertThat(fits(night, MON.plusDays(1), "05:00", "07:00")).isFalse();
            assertThat(fits(night, MON.plusDays(1), "23:00", "05:00")).isFalse();  // Salı gecesi
            assertThat(fits(night, MON.minusDays(1), "04:00", "06:00")).isFalse(); // Pazar sabahı
        }

        @Test
        @DisplayName("Pazar gecesi bloğu haftayı sarar: Pazartesi 02:00–05:00'ı kapsar")
        void sundayNightBlock_wrapsWeek() {
            var sun = List.of(block(java.time.DayOfWeek.SUNDAY, "22:00", "06:00"));
            assertThat(fits(sun, MON, "02:00", "05:00")).isTrue();
            assertThat(fits(sun, MON.minusDays(1), "23:00", "05:00")).isTrue();
        }

        @Test
        @DisplayName("Gündüz bloğu gece vardiyasını tek başına kapsamaz; bitişik bloklar birleşir")
        void dayBlocks_adjacentMerge() {
            var eveningOnly = List.of(block(java.time.DayOfWeek.MONDAY, "18:00", "23:59"));
            assertThat(fits(eveningOnly, MON, "22:00", "06:00")).isFalse();
            assertThat(fits(eveningOnly, MON, "20:00", "00:00")).isTrue();   // 23:59 = gün sonu

            var joined = List.of(block(java.time.DayOfWeek.MONDAY, "18:00", "23:59"),
                    block(java.time.DayOfWeek.TUESDAY, "00:00", "08:00"));
            assertThat(fits(joined, MON, "22:00", "06:00")).isTrue();
        }

        @Test
        @DisplayName("Gündüz bloğu gündüz vardiyası: eski davranış korunur")
        void dayBlock_dayShift_unchanged() {
            var day = List.of(block(java.time.DayOfWeek.MONDAY, "09:00", "17:00"));
            assertThat(fits(day, MON, "10:00", "16:00")).isTrue();
            assertThat(fits(day, MON, "08:00", "16:00")).isFalse();
            assertThat(fits(day, MON.plusDays(1), "10:00", "16:00")).isFalse();
        }
    }
}
