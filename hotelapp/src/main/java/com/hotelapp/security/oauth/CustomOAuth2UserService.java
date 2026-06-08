package com.hotelapp.security.oauth;

import com.hotelapp.entity.User;
import com.hotelapp.enums.AuthProvider;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * #92: Google'dan dönen user bilgisini DB'ye işler.
 *
 * Akış:
 *   1) Mevcut email varsa: provider'ı GOOGLE'a güncelle (kullanıcı LOCAL'den geçti)
 *   2) Email yoksa: yeni CANDIDATE hesabı oluştur (şifre yok)
 *   3) DefaultOAuth2User döner → SuccessHandler JWT üretir
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        Map<String, Object> attrs = oAuth2User.getAttributes();

        String email     = ((String) attrs.get("email")).toLowerCase().trim();
        String name      = (String) attrs.getOrDefault("name", email);
        String googleId  = (String) attrs.get("sub");          // Google unique ID
        Boolean verified = (Boolean) attrs.getOrDefault("email_verified", false);

        if (!Boolean.TRUE.equals(verified)) {
            log.warn("[OAUTH] Google email doğrulanmamış: {}", email);
            throw new OAuth2AuthenticationException("Email Google'da doğrulanmamış.");
        }

        Optional<User> existingOpt = userRepository.findByEmail(email);
        User user;
        if (existingOpt.isPresent()) {
            // Mevcut kullanıcı — provider güncelle (LOCAL'den geçtiyse)
            user = existingOpt.get();
            if (user.getProvider() != AuthProvider.GOOGLE) {
                user.setProvider(AuthProvider.GOOGLE);
                user.setProviderId(googleId);
                userRepository.save(user);
                log.info("[OAUTH] Mevcut LOCAL kullanıcı GOOGLE'a yükseltildi: userId={}", user.getId());
            } else {
                log.info("[OAUTH] Mevcut GOOGLE kullanıcı giriş yaptı: userId={}", user.getId());
            }
        } else {
            // Yeni kullanıcı — CANDIDATE rolüyle oluştur.
            // password DB'de NOT NULL — OAuth user'a kullanılamaz random BCrypt hash koy.
            // (Kullanıcı isterse "şifremi unuttum" ile gerçek şifre belirleyebilir.)
            String randomPassword = passwordEncoder.encode("OAUTH-" + UUID.randomUUID());
            user = User.builder()
                    .email(email)
                    .password(randomPassword)
                    .fullName(name)
                    .role(Role.CANDIDATE)
                    .provider(AuthProvider.GOOGLE)
                    .providerId(googleId)
                    .enabled(true)
                    .build();
            userRepository.save(user);
            log.info("[OAUTH] Yeni Google kullanıcısı oluşturuldu: userId={} email={}", user.getId(), email);
        }

        // SuccessHandler bu attribute'lardan userId'yi okuyacak
        return new DefaultOAuth2User(
                Collections.singleton(() -> "ROLE_" + user.getRole().name()),
                Map.of(
                        "userId", user.getId(),
                        "email",  user.getEmail(),
                        "name",   user.getFullName(),
                        "role",   user.getRole().name()
                ),
                "email"  // name attribute key
        );
    }
}
