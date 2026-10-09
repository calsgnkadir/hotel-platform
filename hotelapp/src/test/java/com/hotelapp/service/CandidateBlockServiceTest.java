package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.CandidateBlockService.BlockedCandidateDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Isletme adayi engeller: yalniz basvuru iliskisi olan aday engellenir (aksi 404),
 * islem idempotent, engel aninda aktif basvurular REJECTED olur (ACCEPTED degismez),
 * liste e-posta/telefon icermez.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CandidateBlockServiceTest {

    private static final long OWNER_ID = 11L;
    private static final long BUSINESS_ID = 2L;
    private static final long CANDIDATE_ID = 7L;

    @Mock private CandidateBlockRepository blockRepository;
    @Mock private BusinessRepository businessRepository;
    @Mock private UserRepository userRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private StandbyService standbyService;
    @Mock private OutboxService outboxService;
    @Mock private FileStorageService fileStorageService;

    private CandidateBlockService service;
    private Business business;
    private User candidate;

    @BeforeEach
    void setUp() {
        service = new CandidateBlockService(blockRepository, businessRepository, userRepository,
                applicationRepository, standbyService, outboxService, fileStorageService);
        User owner = User.builder().id(OWNER_ID).role(Role.BUSINESS_OWNER).email("isletme@test.local").build();
        business = Business.builder().id(BUSINESS_ID).name("Test Otel").owner(owner).build();
        candidate = User.builder().id(CANDIDATE_ID).role(Role.CANDIDATE)
                .fullName("Test Aday").email("aday@test.local").phone("05550000000")
                .avatarPath("avatars/a1").build();
        when(businessRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.of(business));
        when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate));
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of());
    }

    private void applied(boolean value) {
        when(applicationRepository.existsByCandidateIdAndJobListingBusinessOwnerId(CANDIDATE_ID, OWNER_ID))
                .thenReturn(value);
    }

    private Application app(long id, ApplicationStatus status, Business b) {
        JobListing l = JobListing.builder().id(100L + id).title("Garson").business(b).build();
        return Application.builder().id(id).status(status).candidate(candidate).jobListing(l).build();
    }

    // ---------------- block ----------------

    @Test
    void blocksCandidateWhoApplied() {
        applied(true);

        service.block(OWNER_ID, CANDIDATE_ID);

        ArgumentCaptor<CandidateBlock> cap = ArgumentCaptor.forClass(CandidateBlock.class);
        verify(blockRepository).save(cap.capture());
        assertThat(cap.getValue().getBusiness()).isSameAs(business);
        assertThat(cap.getValue().getCandidate()).isSameAs(candidate);
        ArgumentCaptor<AuditLoggedEvent> audit = ArgumentCaptor.forClass(AuditLoggedEvent.class);
        verify(outboxService).appendAuditLog(audit.capture());
        assertThat(audit.getValue().action()).isEqualTo("BLOCK_CANDIDATE");
        assertThat(audit.getValue().actorId()).isEqualTo(OWNER_ID);
    }

    @Test
    void candidateWithoutRelationIs404AndNothingSaved() {
        applied(false);

        assertThatThrownBy(() -> service.block(OWNER_ID, CANDIDATE_ID))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(blockRepository, never()).save(any());
        verify(applicationRepository, never()).save(any());
    }

    @Test
    void nonCandidateTargetIs404() {
        User otherOwner = User.builder().id(55L).role(Role.BUSINESS_OWNER).build();
        when(userRepository.findById(55L)).thenReturn(Optional.of(otherOwner));
        when(applicationRepository.existsByCandidateIdAndJobListingBusinessOwnerId(55L, OWNER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.block(OWNER_ID, 55L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(blockRepository, never()).save(any());
    }

    @Test
    void missingUserIs404() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.block(OWNER_ID, 999L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(blockRepository, never()).save(any());
    }

    @Test
    void ownerWithoutBusinessGets422() {
        when(businessRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.block(OWNER_ID, CANDIDATE_ID))
                .isInstanceOf(BusinessRuleException.class);
        verify(blockRepository, never()).save(any());
    }

    @Test
    void blockIsIdempotent() {
        when(blockRepository.existsByBusinessIdAndCandidateId(BUSINESS_ID, CANDIDATE_ID)).thenReturn(true);

        service.block(OWNER_ID, CANDIDATE_ID);

        verify(blockRepository, never()).save(any());
        verify(outboxService, never()).appendAuditLog(any());
    }

    @Test
    void activeApplicationsRejectedAcceptedAndOtherBusinessUntouched() {
        applied(true);
        Business other = Business.builder().id(99L).name("Baska Otel").build();

        Application pending = app(1, ApplicationStatus.PENDING, business);
        Application reviewing = app(2, ApplicationStatus.REVIEWING, business);
        Application held = app(3, ApplicationStatus.HELD, business);
        held.setHoldDeadline(LocalDateTime.now().plusHours(5));
        Application standby = app(4, ApplicationStatus.STANDBY, business);
        standby.setStandbyRank(1);
        Application accepted = app(5, ApplicationStatus.ACCEPTED, business);
        Application withdrawn = app(6, ApplicationStatus.WITHDRAWN, business);
        Application otherBusiness = app(7, ApplicationStatus.PENDING, other);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(
                Arrays.asList(pending, reviewing, held, standby, accepted, withdrawn, otherBusiness));

        service.block(OWNER_ID, CANDIDATE_ID);

        assertThat(List.of(pending, reviewing, held, standby))
                .allSatisfy(a -> assertThat(a.getStatus()).isEqualTo(ApplicationStatus.REJECTED));
        assertThat(held.getHoldDeadline()).isNull();
        assertThat(standby.getStandbyRank()).isNull();
        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        assertThat(withdrawn.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        assertThat(otherBusiness.getStatus()).isEqualTo(ApplicationStatus.PENDING);
        verify(applicationRepository, times(4)).save(any(Application.class));
        verify(standbyService, never()).offerAfterNoShow(anyLong());
    }

    @Test
    void rejectingStandbyWithActiveOfferCascadesToNextStandby() {
        applied(true);
        Application offered = app(4, ApplicationStatus.STANDBY, business);
        offered.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(5));
        offered.setStandbyDeadline(LocalDateTime.now().plusHours(2));
        offered.setStandbyReplacesApplicationId(42L);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(offered));

        service.block(OWNER_ID, CANDIDATE_ID);

        assertThat(offered.getStatus()).isEqualTo(ApplicationStatus.REJECTED);
        assertThat(offered.getStandbyDeadline()).isNull();
        assertThat(offered.getStandbyReplacesApplicationId()).isNull();
        verify(standbyService).offerAfterNoShow(42L);
    }

    // ---------------- unblock ----------------

    @Test
    void unblockDeletesExisting() {
        CandidateBlock b = CandidateBlock.builder().id(1L).business(business).candidate(candidate).build();
        when(blockRepository.findByBusinessIdAndCandidateId(BUSINESS_ID, CANDIDATE_ID)).thenReturn(Optional.of(b));

        service.unblock(OWNER_ID, CANDIDATE_ID);

        verify(blockRepository).delete(b);
    }

    @Test
    void unblockIsIdempotent() {
        when(blockRepository.findByBusinessIdAndCandidateId(BUSINESS_ID, CANDIDATE_ID)).thenReturn(Optional.empty());

        service.unblock(OWNER_ID, CANDIDATE_ID);

        verify(blockRepository, never()).delete(any());
        verify(outboxService, never()).appendAuditLog(any());
    }

    // ---------------- list ----------------

    @Test
    void listContainsNoEmailOrPhone() {
        LocalDateTime at = LocalDateTime.of(2026, 10, 1, 12, 0);
        CandidateBlock b = CandidateBlock.builder().id(1L).business(business).candidate(candidate).createdAt(at).build();
        when(blockRepository.findByBusinessIdOrderByCreatedAtDesc(BUSINESS_ID)).thenReturn(List.of(b));
        when(fileStorageService.publicUrl("avatars/a1")).thenReturn("https://cdn.test/avatars/a1");

        List<BlockedCandidateDto> list = service.listBlocked(OWNER_ID);

        assertThat(list).hasSize(1);
        BlockedCandidateDto dto = list.get(0);
        assertThat(dto.getCandidateId()).isEqualTo(CANDIDATE_ID);
        assertThat(dto.getCandidateName()).isEqualTo("Test Aday");
        assertThat(dto.getCandidateAvatarUrl()).isEqualTo("https://cdn.test/avatars/a1");
        assertThat(dto.getBlockedAt()).isEqualTo(at);
        assertThat(Arrays.stream(BlockedCandidateDto.class.getDeclaredFields()).map(f -> f.getName()))
                .containsExactlyInAnyOrder("candidateId", "candidateName", "candidateAvatarUrl", "blockedAt");
        assertThat(dto.toString()).doesNotContain("aday@test.local", "05550000000");
    }
}
