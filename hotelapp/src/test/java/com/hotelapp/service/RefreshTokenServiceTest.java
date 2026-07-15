package com.hotelapp.service;

import com.hotelapp.entity.RefreshToken;
import com.hotelapp.entity.User;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * FAZ H.2 — Refresh token rotation davranış denetimi.
 *
 * Audit raporundaki "entity var, kullanımı doğrula" sinyali — bu test
 * suite gerçek rotation + reuse-detection davranışını kanıtlar.
 */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock private RefreshTokenRepository repo;
    @InjectMocks private RefreshTokenService service;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(42L);
        testUser.setEmail("test@x.com");
    }

    @Test
    @DisplayName("createForUser: 256-bit raw token uretir + hash DB'ye yazilir")
    void createForUser_returnsRawAndSavesHash() {
        when(repo.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        String raw1 = service.createForUser(testUser);
        String raw2 = service.createForUser(testUser);

        assertThat(raw1).isNotBlank().hasSizeGreaterThan(40);
        assertThat(raw2).isNotBlank();
        assertThat(raw1).isNotEqualTo(raw2);  // her cagri benzersiz

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repo, times(2)).save(captor.capture());
        for (RefreshToken t : captor.getAllValues()) {
            assertThat(t.getUser()).isSameAs(testUser);
            assertThat(t.getTokenHash()).hasSize(64);  // sha256 hex
            assertThat(t.isRevoked()).isFalse();
            assertThat(t.getExpiresAt()).isAfter(LocalDateTime.now().plusDays(6));
        }
    }

    @Test
    @DisplayName("validateAndRotate: gecerli token -> eski revoke + yeni raw uretilir")
    void validateAndRotate_happyPath() {
        // ARRANGE: ilk token uret
        when(repo.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
        String rawOld = service.createForUser(testUser);

        // Bu raw'a karsilik gelen mock DB row'unu hazirla
        RefreshToken stored = RefreshToken.builder()
                .user(testUser)
                .tokenHash(captureLastSavedHash())  // ilk save'in hash'i
                .expiresAt(LocalDateTime.now().plusDays(5))
                .revoked(false)
                .build();
        when(repo.findByTokenHash(stored.getTokenHash())).thenReturn(Optional.of(stored));

        // ACT
        var result = service.validateAndRotate(rawOld);

        // ASSERT
        assertThat(result).isNotNull();
        assertThat(result.user()).isSameAs(testUser);
        assertThat(result.newRawRefreshToken()).isNotBlank().isNotEqualTo(rawOld);
        // Eski token revoke isaretlenmis olmali
        assertThat(stored.isRevoked()).isTrue();
        assertThat(stored.getLastUsedAt()).isNotNull();
    }

    @Test
    @DisplayName("validateAndRotate: REUSE (revoked replay) -> tum kullanici token'lari revoke + 401")
    void validateAndRotate_revokedReuse_revokesAll() {
        RefreshToken revoked = RefreshToken.builder()
                .user(testUser)
                .tokenHash("anyhash")
                .expiresAt(LocalDateTime.now().plusDays(3))
                .revoked(true)   // ZATEN revoked
                .build();
        when(repo.findByTokenHash(any())).thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> service.validateAndRotate("some-raw-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("error.auth.tokenBreach");  // "güvenlik ihlali" Türkçe i = ASCII güvenli kelime

        // Tum user token'lari revoke edilmis olmali (replay saldirisi defense)
        verify(repo).revokeAllForUser(eq(42L));
    }

    @Test
    @DisplayName("validateAndRotate: expired token -> 401, revokeAll YAPMAZ")
    void validateAndRotate_expired() {
        RefreshToken expired = RefreshToken.builder()
                .user(testUser)
                .tokenHash("h")
                .expiresAt(LocalDateTime.now().minusDays(1))  // GECMIS
                .revoked(false)
                .build();
        when(repo.findByTokenHash(any())).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.validateAndRotate("raw"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("error.auth.refreshExpired");  // "süresi dolmuş. Tekrar giriş"

        verify(repo, never()).revokeAllForUser(anyLong());
    }

    @Test
    @DisplayName("validateAndRotate: bulunamayan token -> 401")
    void validateAndRotate_notFound() {
        when(repo.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.validateAndRotate("missing"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("error.auth.refreshInvalid");  // ASCII safe prefix
    }

    @Test
    @DisplayName("validateAndRotate: bos/null token -> 401")
    void validateAndRotate_blankInput() {
        assertThatThrownBy(() -> service.validateAndRotate(null))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.validateAndRotate("   "))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("revoke: bulunan token revoked=true isaretlenir")
    void revoke_marksRevoked() {
        RefreshToken t = RefreshToken.builder()
                .user(testUser).tokenHash("h")
                .expiresAt(LocalDateTime.now().plusDays(3))
                .revoked(false).build();
        when(repo.findByTokenHash(any())).thenReturn(Optional.of(t));

        service.revoke("raw");

        assertThat(t.isRevoked()).isTrue();
        verify(repo).save(t);
    }

    @Test
    @DisplayName("revoke: bos input -> no-op (exception YOK)")
    void revoke_blank_noop() {
        service.revoke(null);
        service.revoke("");
        verify(repo, never()).findByTokenHash(any());
    }

    // ── helper ────────────────────────────────────────────────
    private String captureLastSavedHash() {
        ArgumentCaptor<RefreshToken> cap = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repo).save(cap.capture());
        return cap.getValue().getTokenHash();
    }
}
