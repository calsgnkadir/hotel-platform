package com.hotelapp.security;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * FAZ 4.9 — Method-level authorization helper.
 *
 * Controller'larda @PreAuthorize SPEL ile kaynak ownership kontrolu:
 *   @PreAuthorize("@securityChecks.isListingOwner(#id)")
 *
 * Avantaj: kontrol controller annotation'inda → service'e ulasilmadan reddedilir.
 * Daha onceki "service icinde getApplicationForBusinessOwner exception atar"
 * pattern'i hâlâ ikincil bir savunma. Bu sayede "defence in depth".
 */
@Component("securityChecks")
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)   // FAZ 4.9 — lazy load (getJobListing, getBusiness) icin
public class SecurityChecks {

    private final ApplicationRepository applicationRepository;
    private final JobListingRepository jobListingRepository;

    /** Kimliklenmis kullaniciyi SecurityContext'ten al (yoksa null). */
    private Long currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        // FAZ 4.6 — Principal artik UserPrincipal (eski: User).
        if (principal instanceof UserPrincipal up) return up.getId();
        return null;
    }

    /** Aday: bu basvuru benim mi? */
    public boolean isApplicationCandidate(Long applicationId) {
        Long uid = currentUserId();
        if (uid == null) return false;
        return applicationRepository.findById(applicationId)
                .map(a -> a.getCandidate().getId().equals(uid))
                .orElse(false);
    }

    /** Isletme: bu basvurunun ilani bana mi ait? */
    public boolean isApplicationBusinessOwner(Long applicationId) {
        Long uid = currentUserId();
        if (uid == null) return false;
        return applicationRepository.findById(applicationId)
                .map(Application::getJobListing)
                .map(JobListing::getBusiness)
                .map(b -> b.getOwner() != null && b.getOwner().getId().equals(uid))
                .orElse(false);
    }

    /** Isletme: bu ilan benim mi? */
    public boolean isListingOwner(Long listingId) {
        Long uid = currentUserId();
        if (uid == null) return false;
        return jobListingRepository.findById(listingId)
                .map(JobListing::getBusiness)
                .map(b -> b.getOwner() != null && b.getOwner().getId().equals(uid))
                .orElse(false);
    }
}
