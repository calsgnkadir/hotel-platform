package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Aday profili erisimi: yalniz aday kendisi, ADMIN ve adayin basvurdugu
 * isletmenin sahibi. Digerleri 404 alir (adayin varligi ifsa edilmez) ve
 * goruntulenme kaydi olusmaz.
 */
class CandidateProfileServiceTest {

    private static final long CANDIDATE = 1L;
    private static final long OTHER_CANDIDATE = 2L;
    private static final long OWNER_APPLIED = 3L;
    private static final long OWNER_NOT_APPLIED = 4L;
    private static final long ADMIN = 5L;

    private UserRepository users;
    private ApplicationRepository applications;
    private ProfileViewService views;
    private CandidateProfileService service;

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
        users = mock(UserRepository.class);
        applications = mock(ApplicationRepository.class);
        views = mock(ProfileViewService.class);
        service = new CandidateProfileService(users, mock(FileStorageService.class), applications, views);

        for (User u : new User[]{
                user(CANDIDATE, Role.CANDIDATE), user(OTHER_CANDIDATE, Role.CANDIDATE),
                user(OWNER_APPLIED, Role.BUSINESS_OWNER), user(OWNER_NOT_APPLIED, Role.BUSINESS_OWNER),
                user(ADMIN, Role.ADMIN)}) {
            when(users.findById(u.getId())).thenReturn(Optional.of(u));
        }
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerId(CANDIDATE, OWNER_APPLIED)).thenReturn(true);
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerId(CANDIDATE, OWNER_NOT_APPLIED)).thenReturn(false);
    }

    @Test
    void candidateSeesOwnProfile() {
        var dto = service.getPublicProfile(CANDIDATE, CANDIDATE);
        assertThat(dto.getId()).isEqualTo(CANDIDATE);
        assertThat(dto.getSensitiveUnlocked()).isTrue();
    }

    @Test
    void candidateCannotSeeAnotherCandidate() {
        assertThatThrownBy(() -> service.getPublicProfile(CANDIDATE, OTHER_CANDIDATE))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(views, never()).record(anyLong(), anyLong());
    }

    @Test
    void businessWithApplicationSeesProfileWithoutSensitiveUnlessAccepted() {
        var dto = service.getPublicProfile(CANDIDATE, OWNER_APPLIED);
        assertThat(dto.getId()).isEqualTo(CANDIDATE);
        assertThat(dto.getSensitiveUnlocked()).isFalse();
        assertThat(dto.getEmail()).isNull();
        verify(views).record(CANDIDATE, OWNER_APPLIED);

        when(applications.existsByCandidateIdAndJobListingBusinessOwnerIdAndStatus(
                CANDIDATE, OWNER_APPLIED, ApplicationStatus.ACCEPTED)).thenReturn(true);
        assertThat(service.getPublicProfile(CANDIDATE, OWNER_APPLIED).getSensitiveUnlocked()).isTrue();
    }

    @Test
    void businessWithoutApplicationGets404() {
        assertThatThrownBy(() -> service.getPublicProfile(CANDIDATE, OWNER_NOT_APPLIED))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(views, never()).record(anyLong(), anyLong());
    }

    @Test
    void adminSeesProfile() {
        var dto = service.getPublicProfile(CANDIDATE, ADMIN);
        assertThat(dto.getId()).isEqualTo(CANDIDATE);
        assertThat(dto.getSensitiveUnlocked()).isTrue();
    }

    @Test
    void nonCandidateTargetIs404EvenForAdmin() {
        assertThatThrownBy(() -> service.getPublicProfile(OWNER_APPLIED, ADMIN))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
