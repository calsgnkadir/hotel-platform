package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.dto.PageResponse;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FAZ C — CQRS-lite: Application read-only sorgular.
 *
 * Bunlar ApplicationService'in (god class) içindeydi; salt-okunur sorgular state
 * değiştirenle aynı sınıfta yer alırken bağımlılıklar şişiyordu. Ayrıştırma:
 *  - command tarafı: ApplicationService (apply, decide, hold, withdraw, no-show, doc)
 *  - query tarafı:   bu sınıf (paged list'ler)
 */
@Service
@RequiredArgsConstructor
public class ApplicationQueryService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationMapper applicationMapper;

    /** #84: Aday başvuruları — sayfalı + opsiyonel status filtresi. */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> getCandidateApplicationsPaged(
            Long candidateId, ApplicationStatus status, Pageable pageable) {
        return PageResponse.of(
                applicationRepository.searchCandidateApplications(candidateId, status, pageable),
                applicationMapper::toResponse);
    }

    /** #84: İşletme başvuruları — sayfalı + status/ilan/arama filtreleri. */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> getBusinessApplicationsPaged(
            Long ownerId, ApplicationStatus status, Long listingId, String q, Pageable pageable) {
        String normalizedQ = (q != null && !q.isBlank()) ? q.trim() : null;
        return PageResponse.of(
                applicationRepository.searchBusinessApplications(ownerId, status, listingId, normalizedQ, pageable),
                applicationMapper::toResponse);
    }
}
