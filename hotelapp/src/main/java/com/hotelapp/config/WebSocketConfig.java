package com.hotelapp.config;

import com.hotelapp.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * FAZ 1/#12+#22 — WebSocket (STOMP) konfigürasyonu.
 *
 * Endpoints:
 *  - /ws                       → handshake endpoint (SockJS fallback)
 *
 * Broker destinations:
 *  - /topic/{...}              → broadcast (conversation messages)
 *  - /user/queue/{...}         → user-specific (notifications, typing)
 *  - /app/{...}                → client → server (send message)
 *
 * Auth: STOMP CONNECT frame'inden JWT okur, kullanıcıyı Principal olarak setler.
 * Frontend client: stompClient.connect({ Authorization: 'Bearer ' + jwt }, ...)
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String allowedOriginsCsv;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOriginsCsv.split(",");
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Server → client: broadcast (/topic) + user-specific (/queue)
        registry.enableSimpleBroker("/topic", "/queue")
                // Heartbeat: 10sn (client/server her 10sn bir ping)
                .setHeartbeatValue(new long[]{10000, 10000})
                .setTaskScheduler(taskScheduler());

        // Client → server prefix
        registry.setApplicationDestinationPrefixes("/app");

        // /user/{userId}/queue/notifications gibi user-specific için
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        try {
                            String email = jwtService.extractUsername(token);
                            UserDetails user = userDetailsService.loadUserByUsername(email);
                            // JwtService.isTokenValid çağrısı extractAllClaims içinde signature + expiry kontrolü yapar
                            if (jwtService.isTokenValid(token, user)) {
                                UsernamePasswordAuthenticationToken auth =
                                        new UsernamePasswordAuthenticationToken(
                                                user, null, user.getAuthorities());
                                accessor.setUser(auth);
                                log.debug("WS CONNECT authenticated: {}", email);
                            } else {
                                log.warn("WS CONNECT token invalid for {}", email);
                            }
                        } catch (Exception e) {
                            log.warn("WS CONNECT JWT parse failed: {}", e.getMessage());
                        }
                    }
                }
                return message;
            }
        });
    }

    /** Heartbeat için tek thread scheduler. */
    private org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler taskScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }
}
