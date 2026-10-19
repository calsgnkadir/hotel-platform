package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Admin: ban oturumlari kapatir; ilan askisi isaretlenir ve yalniz admin ACTIVE ile kalkar. */
class AdminServiceTest {

    private UserRepository users;
    private JobListingRepository listings;
    private RefreshTokenService refreshTokens;
    private JobListingService jobListingService;
    private AccountClosureService accountClosure;
    private AdminService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        listings = mock(JobListingRepository.class);
        refreshTokens = mock(RefreshTokenService.class);
        jobListingService = mock(JobListingService.class);
        accountClosure = mock(AccountClosureService.class);
        // Gercek kapanis yolunu taklit et: durumu CLOSED yapar (yan etkiler JobListingServiceTest'te)
        org.mockito.Mockito.doAnswer(i -> { ((JobListing) i.getArgument(0)).setStatus(ListingStatus.CLOSED); return null; })
                .when(jobListingService).closeAsModeration(org.mockito.ArgumentMatchers.any(JobListing.class));
        service = new AdminService(users, mock(BusinessRepository.class), listings,
                mock(ApplicationRepository.class), refreshTokens, jobListingService, accountClosure);
    }

    @Test
    @DisplayName("Ban: kullanicinin tum refresh token'lari iptal edilir")
    void ban_revokesAllRefreshTokens() {
        User u = new User();
        u.setId(5L);
        u.setRole(Role.CANDIDATE);
        when(users.findById(5L)).thenReturn(Optional.of(u));

        service.ban(5L, 7);

        assertThat(u.getBannedUntil()).isNotNull();
        verify(refreshTokens).revokeAllForUser(5L);
        // Aday: ban suresine dusen gelecek vardiyalar bosalir (sinir = ban bitisi)
        verify(accountClosure).releaseCandidate(5L, u.getBannedUntil(), AccountClosureService.Reason.SUSPENDED);
    }

    @Test
    @DisplayName("Ban (isletme sahibi): ilanlar askiya alinir, aday taahhut bosaltma (aday yolu) cagrilmaz")
    void ban_businessOwner_suspendsListings() {
        User u = new User();
        u.setId(6L);
        u.setRole(Role.BUSINESS_OWNER);
        when(users.findById(6L)).thenReturn(Optional.of(u));

        service.ban(6L, 7);

        verify(refreshTokens).revokeAllForUser(6L);
        verify(accountClosure).suspendBusinessListings(6L);
        verify(accountClosure, org.mockito.Mockito.never())
                .releaseCandidate(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Ban kaldirma ilanlari kendiliginden acmaz (admin acar)")
    void unban_doesNotReopenListings() {
        User u = new User();
        u.setId(6L);
        u.setRole(Role.BUSINESS_OWNER);
        u.setBannedUntil(java.time.LocalDateTime.now().plusDays(3));
        when(users.findById(6L)).thenReturn(Optional.of(u));

        service.unban(6L);

        assertThat(u.getBannedUntil()).isNull();
        org.mockito.Mockito.verifyNoInteractions(accountClosure, jobListingService);
    }

    @Test
    @DisplayName("Admin PAUSED/CLOSED -> adminSuspended=true; admin ACTIVE -> bayrak kalkar")
    void listingStatus_setsAndClearsSuspension() {
        JobListing l = JobListing.builder().id(9L).title("Garson").status(ListingStatus.ACTIVE).build();
        when(listings.findById(9L)).thenReturn(Optional.of(l));

        var dto = service.setListingStatus(9L, ListingStatus.PAUSED);
        assertThat(l.isAdminSuspended()).isTrue();
        assertThat(dto.isAdminSuspended()).isTrue();

        service.setListingStatus(9L, ListingStatus.CLOSED);
        assertThat(l.isAdminSuspended()).isTrue();
        // Admin kapanisi ortak kapanis yolunu kullanir (acik basvurular askida kalmaz)
        verify(jobListingService).closeAsModeration(l);
        assertThat(l.getStatus()).isEqualTo(ListingStatus.CLOSED);

        dto = service.setListingStatus(9L, ListingStatus.ACTIVE);
        assertThat(l.isAdminSuspended()).isFalse();
        assertThat(dto.isAdminSuspended()).isFalse();
        assertThat(l.getStatus()).isEqualTo(ListingStatus.ACTIVE);
    }
}
