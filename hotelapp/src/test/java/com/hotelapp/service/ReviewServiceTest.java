package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.Review;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ReviewRepository;
import com.hotelapp.service.ReviewService.CreateReviewRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock private ReviewRepository reviewRepository;
    @Mock private ApplicationRepository applicationRepository;
    @InjectMocks private ReviewService service;

    private static final Long APP_ID = 50L;
    private static final Long CANDIDATE_ID = 7L;

    private Application acceptedApp(LocalDate latestSlotDate) {
        User candidate = new User();
        candidate.setId(CANDIDATE_ID);
        Application a = new Application();
        a.setId(APP_ID);
        a.setStatus(ApplicationStatus.ACCEPTED);
        a.setCandidate(candidate);

        if (latestSlotDate != null) {
            ShiftSlot slot = new ShiftSlot();
            slot.setDate(latestSlotDate);
            a.setRequestedSlots(new java.util.HashSet<>(List.of(slot)));
        }
        a.setJobListing(new JobListing());
        return a;
    }

    private CreateReviewRequest req(int rating) {
        CreateReviewRequest r = new CreateReviewRequest();
        r.setRating(rating);
        r.setComment("Çok güzeldi");
        return r;
    }

    @Test
    @DisplayName("PENDING basvuru yorumlanamaz -> BusinessRuleException")
    void pendingCannotBeReviewed() {
        Application a = acceptedApp(LocalDate.now().minusDays(1));
        a.setStatus(ApplicationStatus.PENDING);
        when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.createReview(APP_ID, CANDIDATE_ID, req(5)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("kabul edilmiş");
    }

    @Test
    @DisplayName("Calisma henuz bitmedi (slot tarihi gelecekte) -> BusinessRuleException")
    void futureSlot_throws() {
        Application a = acceptedApp(LocalDate.now().plusDays(3));
        when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.createReview(APP_ID, CANDIDATE_ID, req(5)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("henüz tamamlanmadı");
    }

    @Test
    @DisplayName("Aday olmayan biri puan veremez -> UnauthorizedException")
    void notTheCandidate_throws() {
        Application a = acceptedApp(LocalDate.now().minusDays(1));
        when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.createReview(APP_ID, 999L, req(5)))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("aday yorum yapabilir");
    }

    @Test
    @DisplayName("Ayni basvuruya 2. kez yorum -> BusinessRuleException")
    void duplicateReview_throws() {
        Application a = acceptedApp(LocalDate.now().minusDays(1));
        when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
        when(reviewRepository.findByApplicationIdAndByRole(APP_ID, "CANDIDATE"))
                .thenReturn(Optional.of(new Review()));

        assertThatThrownBy(() -> service.createReview(APP_ID, CANDIDATE_ID, req(5)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("zaten yorum yaptınız");
    }

    @Test
    @DisplayName("4 aspect dolu -> rating ortalamasi hesaplanir, save edilir")
    void fourAspects_averagedAndSaved() {
        Application a = acceptedApp(LocalDate.now().minusDays(2));
        a.setJobListing(new JobListing());
        a.getJobListing().setBusiness(new com.hotelapp.entity.Business());
        a.getJobListing().getBusiness().setName("Biz");
        a.getCandidate().setFullName("Aday");

        when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
        when(reviewRepository.findByApplicationIdAndByRole(APP_ID, "CANDIDATE"))
                .thenReturn(Optional.empty());
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CreateReviewRequest r = new CreateReviewRequest();
        r.setAspect1(5); r.setAspect2(4); r.setAspect3(5); r.setAspect4(2); // ort = 4
        r.setRating(1);  // override edilmeli (aspect varsa)

        var dto = service.createReview(APP_ID, CANDIDATE_ID, r);

        ArgumentCaptor<Review> captor = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository).save(captor.capture());
        assertThat(captor.getValue().getRating()).isEqualTo(4);  // (5+4+5+2)/4 = 4
        assertThat(dto.getRating()).isEqualTo(4);
    }

    @Test
    @DisplayName("isWorkCompleted: slot tarihleri gecmiste -> true")
    void isWorkCompleted_pastSlots_true() {
        Application a = acceptedApp(LocalDate.now().minusDays(1));
        assertThat(service.isWorkCompleted(a)).isTrue();
    }

    @Test
    @DisplayName("isWorkCompleted: slot bos -> true (backward compat)")
    void isWorkCompleted_emptySlots_true() {
        Application a = acceptedApp(null);
        assertThat(service.isWorkCompleted(a)).isTrue();
    }

    @Test
    @DisplayName("isWorkCompleted: slot bugun ya da ileride -> false")
    void isWorkCompleted_futureSlot_false() {
        Application a = acceptedApp(LocalDate.now().plusDays(1));
        assertThat(service.isWorkCompleted(a)).isFalse();
    }
}
