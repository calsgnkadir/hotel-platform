package com.hotelapp.security;

import com.hotelapp.entity.Conversation;
import com.hotelapp.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * STOMP gelen kanal yetkisi (WebSocketConfig'e baglanir).
 *
 * <ul>
 *   <li><b>CONNECT</b>: gecerli Bearer JWT zorunlu; kullanici etkin (enabled) ve
 *       banli degil olmali (JwtAuthFilter ile ayni kural). Aksi halde baglanti
 *       reddedilir (STOMP ERROR + oturum kapanir).</li>
 *   <li><b>SUBSCRIBE</b>: yalniz izinli hedefler. {@code /user/queue/**} (kisiye ozel,
 *       oturuma cozulur), {@code /topic/typing.{conversationId}} (yalniz sohbet uyesi),
 *       {@code /topic/pulse} (kisisel veri icermeyen topluluk sayaclari). Diger her sey
 *       — {@code /topic/presence} dahil (artik {@code /user/queue/presence}) ve dogrudan
 *       {@code /queue/**} — sessizce dusurulur (baglanti kapanmaz, abonelik olusmaz).</li>
 *   <li><b>SEND</b>: yalniz {@code /app/**}. Istemcinin broker hedeflerine
 *       ({@code /topic}, {@code /queue}) dogrudan mesaj basmasi engellenir.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompAuthorizationInterceptor implements ChannelInterceptor {

    static final Pattern TYPING_TOPIC = Pattern.compile("^/topic/typing\\.(\\d{1,18})$");

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final ConversationRepository conversationRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
            return message;
        }
        if (StompCommand.SUBSCRIBE.equals(command)) {
            if (!canSubscribe(accessor.getUser(), accessor.getDestination())) {
                log.debug("[WS] SUBSCRIBE reddedildi: dest={}", accessor.getDestination());
                return null;
            }
            return message;
        }
        if (StompCommand.SEND.equals(command)) {
            String dest = accessor.getDestination();
            if (accessor.getUser() == null || dest == null || !dest.startsWith("/app/")) {
                log.debug("[WS] SEND reddedildi: dest={}", dest);
                return null;
            }
        }
        return message;
    }

    /** Gecerli token + etkin + banli olmayan kullanici; aksi halde AccessDeniedException. */
    UsernamePasswordAuthenticationToken authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("WS CONNECT: kimlik doğrulama gerekli");
        }
        String token = authHeader.substring(7);
        UserDetails user;
        try {
            String email = jwtService.extractUsername(token);
            user = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(token, user)) user = null;
        } catch (Exception e) {
            user = null;
        }
        if (user == null || !user.isEnabled() || !user.isAccountNonLocked()) {
            log.debug("[WS] CONNECT reddedildi (gecersiz token ya da hesap kapali)");
            throw new AccessDeniedException("WS CONNECT: kimlik doğrulama başarısız");
        }
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }

    boolean canSubscribe(Principal principal, String destination) {
        if (principal == null || destination == null) return false;
        if (destination.startsWith("/user/queue/")) return true;
        if ("/topic/pulse".equals(destination)) return true;
        Matcher m = TYPING_TOPIC.matcher(destination);
        if (m.matches()) {
            Long userId = userId(principal);
            if (userId == null) return false;
            Conversation c = conversationRepository.findById(Long.valueOf(m.group(1))).orElse(null);
            return c != null && (userId.equals(c.getCandidate().getId())
                    || userId.equals(c.getBusinessOwner().getId()));
        }
        return false;
    }

    private static Long userId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken t
                && t.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
