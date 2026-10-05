package com.hotelapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Uçtan uca: sahte push sunucusuna (JDK HttpServer) gerçek HTTP isteği gider,
 * gövde telefon tarafı gibi çözülür.
 */
class WebPushServiceTest {

    private HttpServer server;
    private final List<Map<String, Object>> received = new ArrayList<>();
    private final AtomicInteger responseStatus = new AtomicInteger(201);
    private PushSubscriptionRepository repo;
    private WebPushService service;

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/push", ex -> {
            byte[] body = ex.getRequestBody().readAllBytes();
            synchronized (received) {
                received.add(Map.of(
                        "body", body,
                        "encoding", String.valueOf(ex.getRequestHeaders().getFirst("Content-Encoding")),
                        "ttl", String.valueOf(ex.getRequestHeaders().getFirst("TTL")),
                        "auth", String.valueOf(ex.getRequestHeaders().getFirst("Authorization"))));
            }
            ex.sendResponseHeaders(responseStatus.get(), -1);
            ex.close();
        });
        server.start();

        VapidService vapid = new VapidService();
        org.springframework.test.util.ReflectionTestUtils.setField(vapid, "subject", "mailto:test@kadrom.local");
        vapid.init();  // anahtar yok → test için üretir
        repo = mock(PushSubscriptionRepository.class);
        // Sahte push sunucusu yerel adreste; testte politika her adrese izin verir
        PushEndpointPolicy allowAll = new PushEndpointPolicy() {
            @Override public boolean isAllowed(String endpoint) { return true; }
        };
        service = new WebPushService(vapid, repo, new ObjectMapper(), allowAll);
    }

    @Test
    @DisplayName("Izinli servis olmayan adrese istek atilmaz, kayit silinir (SSRF)")
    void disallowedEndpoint_notContacted_andDeleted() throws Exception {
        VapidService vapid = new VapidService();
        org.springframework.test.util.ReflectionTestUtils.setField(vapid, "subject", "mailto:test@kadrom.local");
        vapid.init();
        WebPushService strict = new WebPushService(vapid, repo, new ObjectMapper(), new PushEndpointPolicy());
        PushSubscription sub = PushSubscription.builder().endpoint(endpoint()).build();
        when(repo.findAllByUserId(7L)).thenReturn(List.of(sub));

        strict.doSend(7L, new WebPushService.PushMessage("T", "M", "/", 1L));

        assertThat(received).isEmpty();
        verify(repo).delete(sub);
    }

    @AfterEach
    void tearDown() { server.stop(0); }

    private String endpoint() { return "http://127.0.0.1:" + server.getAddress().getPort() + "/push"; }

    private static String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    @Test
    @DisplayName("Anahtarlı abonelik: içerik şifreli gider, telefon tarafında çözülür")
    void encryptedPayload_isDecryptableByUserAgent() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair ua = gen.generateKeyPair();
        byte[] uaPublic = WebPushEncryption.rawPublic((ECPublicKey) ua.getPublic());
        byte[] auth = new byte[16];
        new java.security.SecureRandom().nextBytes(auth);

        PushSubscription sub = PushSubscription.builder()
                .endpoint(endpoint()).p256dh(b64(uaPublic)).authSecret(b64(auth)).build();
        when(repo.findAllByUserId(7L)).thenReturn(List.of(sub));

        service.doSend(7L, new WebPushService.PushMessage(
                "Başvurun kabul edildi", "Garson · Cafe Köşe ilanına başvurun kabul edildi!",
                "/candidate?tab=applications", 99L));

        assertThat(received).hasSize(1);
        Map<String, Object> req = received.get(0);
        assertThat(req.get("encoding")).isEqualTo("aes128gcm");
        assertThat(req.get("ttl")).isEqualTo("86400");
        assertThat((String) req.get("auth")).startsWith("vapid t=");

        byte[] plain = WebPushEncryptionTest.decryptAsUserAgent(
                (byte[]) req.get("body"), (ECPrivateKey) ua.getPrivate(), uaPublic, auth);
        JsonNode json = new ObjectMapper().readTree(plain);
        assertThat(json.get("title").asText()).isEqualTo("Başvurun kabul edildi");
        assertThat(json.get("body").asText()).isEqualTo("Garson · Cafe Köşe ilanına başvurun kabul edildi!");
        assertThat(json.get("link").asText()).isEqualTo("/candidate?tab=applications");
        assertThat(json.get("notificationId").asLong()).isEqualTo(99L);
    }

    @Test
    @DisplayName("Anahtarsız eski abonelik: içeriksiz push gider (genel metin)")
    void legacySubscriptionWithoutKeys_getsEmptyPush() {
        when(repo.findAllByUserId(7L)).thenReturn(List.of(PushSubscription.builder().endpoint(endpoint()).build()));

        service.doSend(7L, new WebPushService.PushMessage("T", "M", "/", 1L));

        assertThat(received).hasSize(1);
        assertThat((byte[]) received.get(0).get("body")).isEmpty();
        assertThat(received.get(0).get("encoding")).isEqualTo("null");
    }

    @Test
    @DisplayName("Push sunucusu 410 derse abonelik silinir, 201'de silinmez")
    void goneSubscription_isDeleted() {
        PushSubscription sub = PushSubscription.builder().endpoint(endpoint()).build();
        when(repo.findAllByUserId(7L)).thenReturn(List.of(sub));

        service.doSend(7L, new WebPushService.PushMessage("T", "M", "/", 1L));
        verify(repo, never()).delete(sub);

        responseStatus.set(410);
        service.doSend(7L, new WebPushService.PushMessage("T", "M", "/", 1L));
        verify(repo).delete(sub);
    }

    @Test
    @DisplayName("Uzun metin kırpılır (push sunucusu sınırı)")
    void longBody_truncated() throws Exception {
        byte[] json = service.toJson(new WebPushService.PushMessage("T", "x".repeat(1000), null, null));
        JsonNode node = new ObjectMapper().readTree(json);
        assertThat(node.get("body").asText()).hasSize(180).endsWith("…");
        assertThat(node.get("link").asText()).isEqualTo("/");
    }
}
