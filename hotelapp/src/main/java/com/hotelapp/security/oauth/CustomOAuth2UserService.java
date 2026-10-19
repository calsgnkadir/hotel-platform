package com.hotelapp.security.oauth;

import com.hotelapp.entity.User;
import com.hotelapp.enums.AuthProvider;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
    private final com.hotelapp.service.RefreshTokenService refreshTokenService;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        User user = upsertGoogleUser(oAuth2User.getAttributes());

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

    /** Google kullanıcı bilgisini DB'ye işler (Google'a çağrı yapmaz; test edilebilir). */
    User upsertGoogleUser(Map<String, Object> attrs) {
        String email     = ((String) attrs.get("email")).toLowerCase().trim();
        String name      = (String) attrs.getOrDefault("name", email);
        String googleId  = (String) attrs.get("sub");          // Google unique ID
        Boolean verified = (Boolean) attrs.getOrDefault("email_verified", false);

        if (!Boolean.TRUE.equals(verified)) {
            log.warn("[OAUTH] Google e-postası doğrulanmamış hesapla giriş reddedildi");
            throw new OAuth2AuthenticationException("Email Google'da doğrulanmamış.");
        }

        Optional<User> existingOpt = userRepository.findByEmail(email);
        User user;
        if (existingOpt.isPresent()) {
            // Mevcut kullanıcı — provider güncelle (LOCAL'den geçtiyse)
            user = existingOpt.get();
            // Yasakli / devre disi (silme talebi) hesap Google ile de oturum acamaz
            // (form girisinde DaoAuthenticationProvider ayni kontrolu yapar).
            if (!user.isEnabled() || (user.getBannedUntil() != null
                    && user.getBannedUntil().isAfter(java.time.LocalDateTime.now()))) {
                log.warn("[OAUTH] Kapalı/yasaklı hesapla Google girişi reddedildi: userId={}", user.getId());
                throw new OAuth2AuthenticationException("Hesap kullanıma kapalı.");
            }
            if (user.getProvider() != AuthProvider.GOOGLE) {
                // Hesap ele geçirme önlemi: e-postası hiç doğrulanmamış LOCAL hesabı bu
                // adresin sahibi olmayan biri açmış olabilir (önceden kayıt saldırısı).
                // Google adresi doğruladığı için hesap gerçek sahibine geçer: eski parola
                // kullanılamaz hale gelir ve açık oturumların hepsi kapanır.
                if (user.getEmailVerifiedAt() == null) {
                    user.setPassword(com.hotelapp.security.UnusablePassword.newHash());
                    refreshTokenService.revokeAllForUser(user.getId());
                    log.warn("[OAUTH] Doğrulanmamış LOCAL hesap Google'a bağlandı: parola geçersizleştirildi, "
                            + "oturumlar kapatıldı: userId={}", user.getId());
                }
                user.setProvider(AuthProvider.GOOGLE);
                user.setProviderId(googleId);
                log.info("[OAUTH] Mevcut LOCAL kullanıcı GOOGLE'a yükseltildi: userId={}", user.getId());
            } else {
                log.info("[OAUTH] Mevcut GOOGLE kullanıcı giriş yaptı: userId={}", user.getId());
            }
            // Google e-postayı doğruladı (email_verified=true yukarıda zorunlu)
            if (user.getEmailVerifiedAt() == null) {
                user.setEmailVerifiedAt(java.time.LocalDateTime.now());
            }
            userRepository.save(user);
        } else {
            // Yeni kullanıcı — CANDIDATE rolüyle oluştur.
            // password DB'de NOT NULL — OAuth user'a kullanılamaz random BCrypt hash koy.
            // (Kullanıcı isterse "şifremi unuttum" ile gerçek şifre belirleyebilir.)
            // KVKK onayı burada yazılmaz: POST /api/auth/oauth/exchange onayı ister.
            user = User.builder()
                    .email(email)
                    .password(com.hotelapp.security.UnusablePassword.newHash())
                    .emailVerifiedAt(java.time.LocalDateTime.now())
                    .fullName(name)
                    .role(Role.CANDIDATE)
                    .provider(AuthProvider.GOOGLE)
                    .providerId(googleId)
                    .enabled(true)
                    .build();
            userRepository.save(user);
            log.info("[OAUTH] Yeni Google kullanıcısı oluşturuldu: userId={}", user.getId());
        }
        return user;
    }
}
