package com.hotelapp.service;

import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Collection;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ApplicationService unit testleri — kritik branching senaryolari.
 *
 * Asil kapsam: validation + state-machine kurallari. Mail/notification/conversation
 * gibi happy path side-effect'leri IT testlerine birakiliyor — burada mock yuku az
 * tutulup early-throw'lara odaklaniliyor.
 *
 * Istisna (FAZ 18): audit trail. Kabul/red/iptal baglayici kararlar ve "kim yapti"
 * izi denetlenebilir olmali; bu yuzden Audit nested class'i happy path'i de kosuyor.
 */
@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private UserRepository userRepository;
    @Mock private JobListingRepository jobListingRepository;
    @Mock private com.hotelapp.repository.DocumentRequestRepository documentRequestRepository;
    @Mock private com.hotelapp.repository.ShiftSlotRepository shiftSlotRepository;
    @Mock private OutboxService outboxService;
    @Mock private NotificationService notificationService;
    @Mock private MessageService messageService;
    @Mock private EmailService emailService;
    @Mock private EmailTemplates emailTemplates;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ApplicationMapper applicationMapper;

    @InjectMocks private ApplicationService service;

    private static final Long CANDIDATE_ID = 7L;
    private static final Long OWNER_ID = 11L;
    private static final Long LISTING_ID = 22L;
    private static final Long APP_ID = 33L;

    // ================================================================
    // createApplication — duplicate check (N+1 fix sonrasi)
    // ================================================================
    @Nested
    @DisplayName("createApplication")
    class CreateApplication {

        @Test
        @DisplayName("İlan PAUSED ise BusinessRuleException")
        void inactiveListing_throws() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(listingWithStatus(ListingStatus.PAUSED)));

            ApplicationRequest req = req();

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("aktif değil");
        }

        @Test
        @DisplayName("Duplicate ACCEPTED: spesifik 'zaten kabul edildi' mesajı")
        void duplicateAccepted_throwsWithAcceptMessage() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(activeListing()));
            stubDuplicate(ApplicationStatus.ACCEPTED);

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.application.dupAccepted");
        }

        @Test
        @DisplayName("Duplicate REVIEWING: spesifik 'inceleniyor' mesajı")
        void duplicateReviewing_throwsWithReviewMessage() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(activeListing()));
            stubDuplicate(ApplicationStatus.REVIEWING);

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.application.dupReviewing");
        }

        @Test
        @DisplayName("Duplicate PENDING: generic 'aktif başvurunuz var' mesajı")
        void duplicatePending_throwsWithGenericMessage() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(activeListing()));
            stubDuplicate(ApplicationStatus.PENDING);

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.application.dupActive");
        }

        @Test
        @DisplayName("Aday yoksa ResourceNotFoundException")
        void candidateNotFound_throws() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("İlan yoksa ResourceNotFoundException")
        void listingNotFound_throws() {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ================================================================
    // reviewApplication — state machine + decision validation
    // ================================================================
    @Nested
    @DisplayName("reviewApplication")
    class ReviewApplication {

        @Test
        @DisplayName("Başvuru zaten ACCEPTED: 'sonuçlandırılmış' hatası")
        void alreadyAccepted_throws() {
            Application app = appWithStatus(ApplicationStatus.ACCEPTED);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.REJECTED);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("sonuçlandırılmış");
        }

        @Test
        @DisplayName("Başvuru REJECTED: 'sonuçlandırılmış' hatası")
        void alreadyRejected_throws() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.REJECTED)));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.ACCEPTED);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("sonuçlandırılmış");
        }

        @Test
        @DisplayName("Geçersiz karar (HOLD): BusinessRuleException")
        void invalidDecision_throws() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.PENDING)));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.HELD);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("error.application.decisionInvalid");
        }

        @Test
        @DisplayName("Başka işletmenin başvurusu: UnauthorizedException")
        void differentOwner_throws() {
            Application app = appWithStatus(ApplicationStatus.PENDING);
            // Owner ID 99 — istek OWNER_ID=11 ile
            app.getJobListing().getBusiness().getOwner().setId(99L);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.ACCEPTED);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, req))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    // ================================================================
    // markNoShow — state machine + auto-ban logic
    // ================================================================
    @Nested
    @DisplayName("markNoShow")
    class MarkNoShow {

        @Test
        @DisplayName("PENDING başvuru: 'sadece kabul edilmiş' hatası")
        void notAccepted_throws() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.PENDING)));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("KABUL EDİLMİŞ");
        }

        @Test
        @DisplayName("Zaten no-show işaretli: 'zaten no-show' hatası")
        void alreadyMarked_throws() {
            Application app = appWithStatus(ApplicationStatus.ACCEPTED);
            app.setNoShow(true);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("zaten no-show");
        }

        @Test
        @DisplayName("2 strike → 1: noShow=true, ban yok, event yayılır")
        void normalStrike_decrementsOnly() {
            Application app = appWithStatus(ApplicationStatus.ACCEPTED);
            app.getCandidate().setStrikesRemaining(2);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            var result = service.markNoShow(APP_ID, OWNER_ID);

            assertThat(app.isNoShow()).isTrue();
            assertThat(app.getCandidate().getStrikesRemaining()).isEqualTo(1);
            assertThat(app.getCandidate().getBannedUntil()).isNull();
            assertThat(result.getAutoBanned()).isFalse();
            assertThat(result.getCandidateStrikesRemaining()).isEqualTo(1);
            verify(eventPublisher).publishEvent(any(com.hotelapp.event.NoShowMarkedEvent.class));
        }

        @Test
        @DisplayName("1 strike → 0: autoBan, 30 gün ban, strikes 3'e reset")
        void lastStrike_triggersAutoBan() {
            Application app = appWithStatus(ApplicationStatus.ACCEPTED);
            app.getCandidate().setStrikesRemaining(1);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            var result = service.markNoShow(APP_ID, OWNER_ID);

            assertThat(result.getAutoBanned()).isTrue();
            assertThat(result.getBannedUntil()).isNotNull();
            assertThat(app.getCandidate().getBannedUntil()).isNotNull();
            // 30 gün
            assertThat(java.time.Duration.between(java.time.LocalDateTime.now(), app.getCandidate().getBannedUntil()).toDays())
                    .isBetween(29L, 30L);
            // Ban sonrasi strike'lar 3'e reset
            assertThat(app.getCandidate().getStrikesRemaining()).isEqualTo(3);
            verify(eventPublisher).publishEvent(any(com.hotelapp.event.NoShowMarkedEvent.class));
        }

        @Test
        @DisplayName("Başka işletmenin başvurusu: UnauthorizedException + event yayılmaz")
        void differentOwner_throwsNoEvent() {
            Application app = appWithStatus(ApplicationStatus.ACCEPTED);
            app.getJobListing().getBusiness().getOwner().setId(99L);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(UnauthorizedException.class);

            verify(eventPublisher, never()).publishEvent(any());
        }
    }

    // ================================================================
    // FAZ 18 — Audit trail (outbox uzerinden)
    //
    // Baglayici kararlar (kabul/red/iptal) audit'lenmeli. Bu testler ayni
    // zamanda reviewApplication/withdrawApplication'in ILK happy-path
    // kapsami — onceden sadece early-throw'lar test ediliyordu.
    // ================================================================
    @Nested
    @DisplayName("audit trail")
    class Audit {

        @Test
        @DisplayName("Kabul: ACCEPT_APPLICATION audit'lenir, aktör işletme sahibi")
        void accept_appendsAudit() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.PENDING)));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.ACCEPTED);

            service.reviewApplication(APP_ID, OWNER_ID, req);

            var ev = captureAudit();
            assertThat(ev.action()).isEqualTo("ACCEPT_APPLICATION");
            assertThat(ev.actorId()).isEqualTo(OWNER_ID);
            assertThat(ev.targetType()).isEqualTo("APPLICATION");
            assertThat(ev.targetId()).isEqualTo(APP_ID);
            assertThat(ev.details()).contains("Test İlan", "aday@test.com", "PENDING");
        }

        @Test
        @DisplayName("Red: REJECT_APPLICATION audit'lenir, gerekçe not'u detaya girer")
        void reject_appendsAuditWithNote() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.REVIEWING)));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.REJECTED);
            req.setNote("Deneyim yetersiz");

            service.reviewApplication(APP_ID, OWNER_ID, req);

            var ev = captureAudit();
            assertThat(ev.action()).isEqualTo("REJECT_APPLICATION");
            assertThat(ev.details()).contains("REVIEWING", "Deneyim yetersiz");
        }

        @Test
        @DisplayName("İptal: WITHDRAW_APPLICATION audit'lenir, aktör ADAY (işletme değil)")
        void withdraw_appendsAuditWithCandidateAsActor() {
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(appWithStatus(ApplicationStatus.PENDING)));

            service.withdrawApplication(APP_ID, CANDIDATE_ID);

            var ev = captureAudit();
            assertThat(ev.action()).isEqualTo("WITHDRAW_APPLICATION");
            assertThat(ev.actorId()).isEqualTo(CANDIDATE_ID);
            assertThat(ev.targetId()).isEqualTo(APP_ID);
        }

        @Test
        @DisplayName("Karar reddedilirse (yetkisiz) audit yazılmaz")
        void unauthorized_noAudit() {
            Application app = appWithStatus(ApplicationStatus.PENDING);
            app.getJobListing().getBusiness().getOwner().setId(99L);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            ReviewRequest req = new ReviewRequest();
            req.setDecision(ApplicationStatus.ACCEPTED);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, req))
                    .isInstanceOf(UnauthorizedException.class);

            verify(outboxService, never()).appendAuditLog(any());
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    private com.hotelapp.event.AuditLoggedEvent captureAudit() {
        ArgumentCaptor<com.hotelapp.event.AuditLoggedEvent> cap =
                ArgumentCaptor.forClass(com.hotelapp.event.AuditLoggedEvent.class);
        verify(outboxService).appendAuditLog(cap.capture());
        return cap.getValue();
    }

    private User candidate() {
        return User.builder().id(CANDIDATE_ID).email("aday@test.com").fullName("Test Aday").strikesRemaining(3).build();
    }

    private User owner() {
        return User.builder().id(OWNER_ID).email("isletme@test.com").build();
    }

    private JobListing listingWithStatus(ListingStatus status) {
        Business b = Business.builder().id(1L).name("Test Otel").owner(owner()).build();
        return JobListing.builder().id(LISTING_ID).title("Test İlan").status(status).business(b).build();
    }

    private JobListing activeListing() {
        return listingWithStatus(ListingStatus.ACTIVE);
    }

    private Application appWithStatus(ApplicationStatus status) {
        return Application.builder()
                .id(APP_ID)
                .status(status)
                .candidate(candidate())
                .jobListing(activeListing())
                .build();
    }

    private ApplicationRequest req() {
        ApplicationRequest r = new ApplicationRequest();
        r.setJobListingId(LISTING_ID);
        return r;
    }

    @SuppressWarnings("unchecked")
    private void stubDuplicate(ApplicationStatus existingStatus) {
        Application existing = appWithStatus(existingStatus);
        when(applicationRepository.findFirstByCandidateIdAndJobListingIdAndStatusIn(
                anyLong(), anyLong(), any(Collection.class)))
                .thenReturn(Optional.of(existing));
    }
}
