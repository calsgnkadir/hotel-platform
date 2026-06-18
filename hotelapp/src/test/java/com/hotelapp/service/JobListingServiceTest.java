package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
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

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobListingServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private BusinessRepository businessRepository;
    @Mock private UserRepository userRepository;
    @Mock private ReviewService reviewService;
    @Mock private NotificationService notificationService;
    @Mock private BusinessPhotoRepository businessPhotoRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private UserAvailabilityBlockRepository availabilityBlockRepository;

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
    @DisplayName("createListing — validation + ownership")
    class CreateListing {

        @Test
        @DisplayName("Business profili yoksa BusinessRuleException")
        void noBusiness_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createListing(OWNER_ID, validRequest()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("İşletme profili bulunamadı");
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
                    .hasMessageContaining("en az 1 vardiya slotu");
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
        @DisplayName("Slot endTime <= startTime -> BusinessRuleException")
        void slotInvalidTimes_throws() {
            when(businessRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(Optional.of(businessOwnedBy(OWNER_ID)));
            ListingRequest r = validRequest();
            r.setShiftSlots(List.of(slot(LocalDate.now().plusDays(3), "18:00", "10:00", 1)));

            assertThatThrownBy(() -> service.createListing(OWNER_ID, r))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("bitiş saati başlangıçtan sonra olmalı");
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
                    .hasMessageContaining("size ait değil");
        }
    }
}
