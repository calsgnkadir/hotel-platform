package com.hotelapp.config;

import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.concurrent.ConcurrentHashMap;

@Configuration
@RequiredArgsConstructor
public class AppConfig {

    private final UserRepository userRepository;

    /** TTL'li in-memory user cache — her HTTP request'te DB hit'ini engeller.
     *  JwtAuthFilter saniyede 5-10 kez ayni email'le findByEmail cagiriyordu;
     *  30 sn cache + token'un kendisi 15dk gecerli oldugu icin guvenli. */
    private static final long TTL_MILLIS = 30_000;
    private final ConcurrentHashMap<String, CachedEntry> userCache = new ConcurrentHashMap<>();

    private record CachedEntry(UserDetails user, long expiresAt) {}

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            long now = System.currentTimeMillis();
            CachedEntry entry = userCache.get(username);
            if (entry != null && entry.expiresAt > now) {
                return entry.user;
            }
            // FAZ 4.6 — User entity'sini UserPrincipal ile wrap et
            UserDetails fresh = userRepository.findByEmail(username)
                    .map(com.hotelapp.security.UserPrincipal::new)
                    .orElseThrow(() -> new UsernameNotFoundException("Kullanıcı bulunamadı: " + username));
            userCache.put(username, new CachedEntry(fresh, now + TTL_MILLIS));
            if (userCache.size() > 1000) {
                userCache.entrySet().removeIf(e -> e.getValue().expiresAt < now);
            }
            return fresh;
        };
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}