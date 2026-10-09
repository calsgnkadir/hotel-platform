package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.CandidateBlock;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Isletme adayi engeller (BusinessRelationService'teki aday->isletme engelinin ters yonu).
 *
 * Kurallar:
 * - Yalnizca bu isletmeye (herhangi bir ilanina, herhangi statude) basvurmus aday
 *   engellenebilir; hedef yok / aday degil / iliski yok -> ayni 404 (varlik ifsa edilmez).
 * - Engel/kaldirma idempotenttir.
 * - Engel aninda adayin bu isletmedeki AKTIF basvurulari (PENDING, REVIEWING, HELD,
 *   STANDBY) REJECTED olur. ACCEPTED'a dokunulmaz (kabul edilmis vardiya bozulmaz).
 *   HELD/STANDBY slot sayacini artirmaz; bu yuzden red slotsFilled'i degistirmez.
 * - Adaya bildirim/e-posta gonderilmez (engel karsi tarafa ifsa edilmez).
 * - Uygulama noktalari: ApplicationService (basvuru, HOLD onayi), StandbyService
 *   (yedek teklifi kabulu), MessageService (sohbet/mesaj/dosya).
 */
@Service
@RequiredArgsConstructor
public class CandidateBlockService {

    /** Engel aninda reddedilen aktif basvuru durumlari. */
    static final Set<ApplicationStatus> ACTIVE_STATUSES = Set.of(
            ApplicationStatus.PENDING,
            ApplicationStatus.REVIEWING,
            ApplicationStatus.HELD,
            ApplicationStatus.STANDBY);

    private final CandidateBlockRepository blockRepository;
    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final StandbyService standbyService;
    private final OutboxService outboxService;
    private final FileStorageService fileStorageService;

    private Business getBusinessForOwner(Long ownerId) {
        return businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessRuleException(
                        "Once isletme profilini olustur (Settings > Isletme)"));
    }

    @Transactional
    public void block(Long ownerId, Long candidateId) {
        Business business = getBusinessForOwner(ownerId);

        boolean alreadyBlocked = blockRepository.existsByBusinessIdAndCandidateId(business.getId(), candidateId);
        if (!alreadyBlocked) {
            User candidate = userRepository.findById(candidateId)
                    .filter(u -> u.getRole() == Role.CANDIDATE)
                    .filter(u -> applicationRepository
                            .existsByCandidateIdAndJobListingBusinessOwnerId(candidateId, ownerId))
                    .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));
            blockRepository.save(CandidateBlock.builder()
                    .business(business)
                    .candidate(candidate)
                    .build());
        }

        // Idempotent cagrida da calisir: engel kontrolu ile basvuru kaydi arasinda
        // yaris olduysa kalan aktif basvuruyu da kapatir.
        int rejected = rejectActiveApplications(business.getId(), candidateId);

        if (!alreadyBlocked || rejected > 0) {
            outboxService.appendAuditLog(AuditLoggedEvent.user(
                    ownerId, "BLOCK_CANDIDATE", "USER", candidateId,
                    "İşletme: " + business.getName()
                            + " · Reddedilen aktif başvuru: " + rejected));
        }
    }

    @Transactional
    public void unblock(Long ownerId, Long candidateId) {
        Business business = getBusinessForOwner(ownerId);
        blockRepository.findByBusinessIdAndCandidateId(business.getId(), candidateId)
                .ifPresent(b -> {
                    blockRepository.delete(b);
                    outboxService.appendAuditLog(AuditLoggedEvent.user(
                            ownerId, "UNBLOCK_CANDIDATE", "USER", candidateId,
                            "İşletme: " + business.getName()));
                });
    }

    @Transactional(readOnly = true)
    public List<BlockedCandidateDto> listBlocked(Long ownerId) {
        Business business = getBusinessForOwner(ownerId);
        return blockRepository.findByBusinessIdOrderByCreatedAtDesc(business.getId())
                .stream().map(this::toDto).toList();
    }

    /**
     * Adayin bu isletmedeki aktif basvurularini REJECTED yapar. Aktif yedek teklifi
     * olan (no-show yerine cagrilmis) STANDBY basvuru reddedilirse sira bir sonraki
     * yedege gecer.
     */
    private int rejectActiveApplications(Long businessId, Long candidateId) {
        LocalDateTime now = LocalDateTime.now();
        List<Long> cascadeFor = new ArrayList<>();
        int count = 0;
        for (Application app : applicationRepository.findAllByCandidateId(candidateId)) {
            if (!businessId.equals(app.getJobListing().getBusiness().getId())) continue;
            if (!ACTIVE_STATUSES.contains(app.getStatus())) continue;

            if (app.getStatus() == ApplicationStatus.STANDBY
                    && app.getStandbyOfferedAt() != null
                    && app.getStandbyReplacesApplicationId() != null) {
                cascadeFor.add(app.getStandbyReplacesApplicationId());
            }
            app.setStatus(ApplicationStatus.REJECTED);
            app.setReviewedAt(now);
            app.setHoldDeadline(null);
            app.setStandbyRank(null);
            app.setStandbyOfferedAt(null);
            app.setStandbyDeadline(null);
            app.setStandbyReplacesApplicationId(null);
            applicationRepository.save(app);
            count++;
        }
        for (Long noShowAppId : cascadeFor) {
            standbyService.offerAfterNoShow(noShowAppId);
        }
        return count;
    }

    /** E-posta/telefon bilerek yok: engel listesi iletisim bilgisi gostermez. */
    private BlockedCandidateDto toDto(CandidateBlock b) {
        User c = b.getCandidate();
        return BlockedCandidateDto.builder()
                .candidateId(c.getId())
                .candidateName(c.getFullName())
                .candidateAvatarUrl(c.getAvatarPath() != null
                        ? fileStorageService.publicUrl(c.getAvatarPath())
                        : null)
                .blockedAt(b.getCreatedAt())
                .build();
    }

    @Data @Builder
    public static class BlockedCandidateDto {
        private Long candidateId;
        private String candidateName;
        private String candidateAvatarUrl;
        private LocalDateTime blockedAt;
    }
}
