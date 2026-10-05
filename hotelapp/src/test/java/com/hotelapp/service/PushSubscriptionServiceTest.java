package com.hotelapp.service;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.PushSubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PushSubscriptionServiceTest {

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

    private PushSubscriptionRepository repo;
    private PushSubscriptionService service;

    @BeforeEach
    void setUp() {
        repo = mock(PushSubscriptionRepository.class);
        service = new PushSubscriptionService(repo, new PushEndpointPolicy());
    }

    private static User user(long id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    @Test
    @DisplayName("subscribe: anahtarlar ve kullanıcı kaydedilir")
    void subscribe_savesKeys() {
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());

        service.subscribe(user(1L), ENDPOINT, "PUBKEY", "AUTHKEY");

        ArgumentCaptor<PushSubscription> saved = ArgumentCaptor.forClass(PushSubscription.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getP256dh()).isEqualTo("PUBKEY");
        assertThat(saved.getValue().getAuthSecret()).isEqualTo("AUTHKEY");
        assertThat(saved.getValue().getUser().getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("subscribe: aynı tarayıcı başka hesapla girerse kayıt yeni kullanıcıya geçer")
    void subscribe_rebindsEndpointToNewUser() {
        PushSubscription existing = PushSubscription.builder().endpoint(ENDPOINT).user(user(1L)).build();
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));

        service.subscribe(user(2L), ENDPOINT, "K", "A");

        assertThat(existing.getUser().getId()).isEqualTo(2L);
        verify(repo).save(existing);
    }

    @Test
    @DisplayName("subscribe: izinli push servisi olmayan adres reddedilir, kaydedilmez (SSRF)")
    void subscribe_rejectsInternalAddress() {
        assertThatThrownBy(() -> service.subscribe(user(1L), "http://127.0.0.1:8080/actuator", "K", "A"))
                .isInstanceOf(BusinessRuleException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("unsubscribe: kendi kaydını siler, başkasınınkine dokunmaz")
    void unsubscribe_onlyOwn() {
        PushSubscription own = PushSubscription.builder().endpoint(ENDPOINT).user(user(1L)).build();
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(own));

        service.unsubscribe(2L, ENDPOINT);
        verify(repo, never()).delete(any(PushSubscription.class));

        service.unsubscribe(1L, ENDPOINT);
        verify(repo).delete(own);
    }

    @Test
    @DisplayName("unsubscribe: kullanıcı ya da adres yoksa hiçbir şey yapmaz")
    void unsubscribe_noUserOrEndpoint_noop() {
        service.unsubscribe(null, ENDPOINT);
        service.unsubscribe(1L, null);
        verifyNoInteractions(repo);
    }
}
