package com.hotelapp.controller;

import com.hotelapp.controller.PushController.SubscriptionDto;
import com.hotelapp.entity.PushSubscription;
import com.hotelapp.entity.User;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.VapidService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PushControllerTest {

    @Mock private VapidService vapidService;
    @Mock private PushSubscriptionRepository repo;
    @InjectMocks private PushController controller;

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

    private static UserPrincipal principal(long id) {
        User u = new User();
        u.setId(id);
        return new UserPrincipal(u);
    }

    private static SubscriptionDto browserJson() {
        SubscriptionDto dto = new SubscriptionDto();
        dto.setEndpoint(ENDPOINT);
        dto.setKeys(Map.of("p256dh", "PUBKEY", "auth", "AUTHKEY"));
        return dto;
    }

    @Test
    @DisplayName("subscribe: tarayicinin toJSON bicimindeki (keys.*) anahtarlar kaydedilir")
    void subscribe_readsNestedKeys() {
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());

        controller.subscribe(principal(1L), browserJson());

        ArgumentCaptor<PushSubscription> saved = ArgumentCaptor.forClass(PushSubscription.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getP256dh()).isEqualTo("PUBKEY");
        assertThat(saved.getValue().getAuthSecret()).isEqualTo("AUTHKEY");
        assertThat(saved.getValue().getUser().getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("subscribe: ayni tarayici baska hesapla girerse kayit yeni kullaniciya gecer")
    void subscribe_rebindsEndpointToNewUser() {
        PushSubscription existing = PushSubscription.builder().endpoint(ENDPOINT).user(principal(1L).getUser()).build();
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));

        controller.subscribe(principal(2L), browserJson());

        assertThat(existing.getUser().getId()).isEqualTo(2L);
        verify(repo).save(existing);
    }

    @Test
    @DisplayName("unsubscribe: kendi kaydini siler")
    void unsubscribe_ownSubscription_deleted() {
        PushSubscription own = PushSubscription.builder().endpoint(ENDPOINT).user(principal(1L).getUser()).build();
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(own));

        controller.unsubscribe(principal(1L), browserJson());

        verify(repo).delete(own);
    }

    @Test
    @DisplayName("unsubscribe: baskasinin kaydina dokunmaz")
    void unsubscribe_foreignSubscription_untouched() {
        PushSubscription foreign = PushSubscription.builder().endpoint(ENDPOINT).user(principal(1L).getUser()).build();
        when(repo.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(foreign));

        controller.unsubscribe(principal(2L), browserJson());

        verify(repo, never()).delete(any(PushSubscription.class));
    }
}
