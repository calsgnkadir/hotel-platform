package com.hotelapp.security;

import com.hotelapp.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * FAZ 4.6 — Spring Security icin User entity wrapper.
 *
 * Eskiden: User entity'si direkt `implements UserDetails` idi → domain'i
 * framework'e baglar, test/serializer/JSON ciktilarinda Spring Security
 * implementation detaylari sizardi.
 *
 * Simdi: User saf domain. UserPrincipal UserDetails sozlesmesini ustlenir,
 * icinde User referansi tutar. Spring Security <-> Domain ayrimi temiz.
 *
 * Controller'larda @AuthenticationPrincipal UserPrincipal currentUser olarak
 * gelir. `currentUser.getId()` ve `currentUser.getAuthorities()` eskisi gibi
 * calisir (delegate).
 */
@RequiredArgsConstructor
public class UserPrincipal implements UserDetails {

    private final User user;

    /** Wrapped domain entity'ye dogrudan erisim — service cagirilarinda gerekirse. */
    public User getUser() {
        return user;
    }

    /** Controller'larda en sik kullanilan — eski User.getId() ile uyumlu. */
    public Long getId() {
        return user.getId();
    }

    // ── UserDetails kontrati ────────────────────────────────────────────

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        LocalDateTime ban = user.getBannedUntil();
        return ban == null || ban.isBefore(LocalDateTime.now());
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }
}
