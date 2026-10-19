package com.hotelapp.config;

import com.hotelapp.security.StompAuthorizationInterceptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
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
 * Geçersiz token / devre dışı / banlı kullanıcı CONNECT'te reddedilir; abonelik ve
 * gönderim yetkisi StompAuthorizationInterceptor'da (presence: /user/queue/presence).
 * Frontend client: stompClient.connect({ Authorization: 'Bearer ' + jwt }, ...)
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthorizationInterceptor stompAuthorizationInterceptor;

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String allowedOriginsCsv;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = SecurityConfig.parseOrigins(allowedOriginsCsv).toArray(new String[0]);
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
        // CONNECT kimlik + hesap durumu, SUBSCRIBE hedef yetkisi, SEND yalniz /app/**
        registration.interceptors(stompAuthorizationInterceptor);
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
