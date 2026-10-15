package com.hotelapp.security.oauth;

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

/**
 * #92: Google OAuth başarılı login sonrası.
 *
 * 1. CustomOAuth2UserService user'ı DB'ye yazdı/günceledi
 * 2. Bu handler kısa ömürlü, tek kullanımlık bir giriş kodu üretir (OAuthLoginCodeStore)
 * 3. Frontend'e redirect: {APP_BASE_URL}/oauth-success#code=...
 *    (fragment: sunucuya, proxy loglarına ve Referer'a gitmez; adreste JWT/e-posta/ad YOK)
 * 4. Frontend kodu POST /api/auth/oauth/exchange ile erişim token'ı + httpOnly refresh
 *    çerezine çevirir ve adresi history.replaceState ile temizler.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final OAuthLoginCodeStore codeStore;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User principal = (OAuth2User) authentication.getPrincipal();
        Long userId = ((Number) principal.getAttribute("userId")).longValue();
        String role = principal.getAttribute("role");

        String code = codeStore.issue(userId);
        String redirectUrl = appBaseUrl + "/oauth-success#code=" + code;

        log.info("[OAUTH] Login başarılı → frontend redirect (tek kullanımlık kod): userId={} role={}", userId, role);
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
