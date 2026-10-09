package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessFavorite;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessFavoriteRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.FavoriteService.FavoriteDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Favori (talent pool) yetki ve gizlilik kurallari:
 * - Isletme yalnizca kendisine basvurmus adayi ekleyebilir; aksi 404, kayit yok.
 * - Aday olmayan hedef de 404.
 * - E-posta yalnizca ACCEPTED iliskide DTO'da; iliskisi kalmamis favori e-postasiz listelenir.
 */
class FavoriteServiceTest {

    private static final long OWNER = 2L;
    private static final long CANDIDATE = 1L;
    private static final long BUSINESS = 20L;

    private BusinessFavoriteRepository favorites;
    private UserRepository users;
    private ApplicationRepository applications;
    private FavoriteService service;
    private Business business;
    private User candidate;

    private static User user(long id, Role role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setFullName("Kullanici " + id);
        u.setEmail("u" + id + "@test.local");
        return u;
    }

    @BeforeEach
    void setUp() {
        favorites = mock(BusinessFavoriteRepository.class);
        BusinessRepository businesses = mock(BusinessRepository.class);
        users = mock(UserRepository.class);
        applications = mock(ApplicationRepository.class);
        service = new FavoriteService(favorites, businesses, users, applications);

        business = Business.builder().id(BUSINESS).build();
        candidate = user(CANDIDATE, Role.CANDIDATE);
        when(businesses.findByOwnerId(OWNER)).thenReturn(Optional.of(business));
        when(users.findById(CANDIDATE)).thenReturn(Optional.of(candidate));
        when(favorites.findByBusinessIdAndCandidateId(BUSINESS, CANDIDATE)).thenReturn(Optional.empty());
        when(favorites.save(any())).thenAnswer(i -> {
            BusinessFavorite f = i.getArgument(0);
            f.setId(77L);
            return f;
        });
    }

    private void applied(boolean value) {
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerId(CANDIDATE, OWNER)).thenReturn(value);
    }

    private void accepted(boolean value) {
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerIdAndStatus(
                CANDIDATE, OWNER, ApplicationStatus.ACCEPTED)).thenReturn(value);
    }

    @Test
    void applicantCanBeFavorited_emailHiddenWithoutAcceptedApplication() {
        applied(true);
        accepted(false);
        FavoriteDto dto = service.addFavorite(OWNER, CANDIDATE, "iyi aday");
        verify(favorites).save(any());
        assertThat(dto.getCandidateId()).isEqualTo(CANDIDATE);
        assertThat(dto.getNote()).isEqualTo("iyi aday");
        assertThat(dto.getCandidateEmail()).isNull();
    }

    @Test
    void acceptedApplicantFavorite_includesEmail() {
        applied(true);
        accepted(true);
        FavoriteDto dto = service.addFavorite(OWNER, CANDIDATE, null);
        assertThat(dto.getCandidateEmail()).isEqualTo("u1@test.local");
    }

    @Test
    void candidateWithoutApplication_isNotFound_andNotSaved() {
        applied(false);
        assertThatThrownBy(() -> service.addFavorite(OWNER, CANDIDATE, null))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(favorites, never()).save(any());
    }

    @Test
    void nonCandidateTarget_isNotFound_andNotSaved() {
        User otherOwner = user(3L, Role.BUSINESS_OWNER);
        when(users.findById(3L)).thenReturn(Optional.of(otherOwner));
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerId(3L, OWNER)).thenReturn(true);
        assertThatThrownBy(() -> service.addFavorite(OWNER, 3L, null))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(favorites, never()).save(any());
    }

    @Test
    void unknownTarget_isNotFound() {
        when(users.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.addFavorite(OWNER, 999L, null))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(favorites, never()).save(any());
    }

    @Test
    void listing_keepsFavoriteWithoutRelation_butWithoutEmail() {
        BusinessFavorite stale = BusinessFavorite.builder()
                .id(5L).business(business).candidate(candidate).createdAt(LocalDateTime.now()).build();
        when(favorites.findByBusinessIdOrderByCreatedAtDesc(BUSINESS)).thenReturn(List.of(stale));
        applied(false);
        accepted(false);
        List<FavoriteDto> list = service.listFavorites(OWNER);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getCandidateId()).isEqualTo(CANDIDATE);
        assertThat(list.get(0).getCandidateEmail()).isNull();
        verify(favorites, never()).delete(any());
    }
}
