package com.hotelapp.security.oauth;

import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * #92: Google OAuth başarılı login sonrası.
 *
 * 1. CustomOAuth2UserService user'ı DB'ye yazdı/günceledi
 * 2. Bu handler JWT üretir
 * 3. Frontend'e redirect: {APP_BASE_URL}/oauth-success?token=...&role=...
 * 4. Frontend OAuthSuccessPage token'ı localStorage'a koyar + dashboard'a yönlendirir
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User principal = (OAuth2User) authentication.getPrincipal();

        Long userId = ((Number) principal.getAttribute("userId")).longValue();
        String email = principal.getAttribute("email");
        String role  = principal.getAttribute("role");

        // JWT üret — local login ile aynı format (UserDetails based)
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("OAuth user kaybedildi: " + userId));
        String jwt = jwtService.generateToken(user);
        String name = principal.getAttribute("name");

        // Frontend AuthContext persist için tüm user bilgisi URL'de
        String redirectUrl = appBaseUrl + "/oauth-success"
                + "?token="    + URLEncoder.encode(jwt,                   StandardCharsets.UTF_8)
                + "&id="       + userId
                + "&email="    + URLEncoder.encode(email,                 StandardCharsets.UTF_8)
                + "&fullName=" + URLEncoder.encode(name != null ? name : "", StandardCharsets.UTF_8)
                + "&role="     + URLEncoder.encode(role,                  StandardCharsets.UTF_8);

        log.info("[OAUTH] Login başarılı → frontend redirect: userId={} role={}", userId, role);
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
