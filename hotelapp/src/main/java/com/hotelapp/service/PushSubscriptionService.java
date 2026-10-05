package com.hotelapp.service;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Push abonelik kayıtları: abone olma, kapatma, çıkışta koparma. */
@Service
@RequiredArgsConstructor
public class PushSubscriptionService {

    private final PushSubscriptionRepository repo;
    private final PushEndpointPolicy endpointPolicy;

    /**
     * Aboneliği kaydeder. Aynı tarayıcı başka bir hesapla girerse kayıt yeni
     * kullanıcıya geçer (ortak cihazda bildirim eski kullanıcıya gitmesin).
     */
    @Transactional
    public void subscribe(User user, String endpoint, String p256dh, String auth) {
        if (!endpointPolicy.isAllowed(endpoint)) {
            throw new BusinessRuleException("Bu tarayıcının bildirim adresi desteklenmiyor.");
        }
        PushSubscription sub = repo.findByEndpoint(endpoint)
                .orElseGet(() -> PushSubscription.builder().endpoint(endpoint).build());
        sub.setUser(user);
        sub.setP256dh(p256dh);
        sub.setAuthSecret(auth);
        repo.save(sub);
    }

    /** Sadece kullanıcının kendi kaydını siler; başkasınınkine dokunmaz. */
    @Transactional
    public void unsubscribe(Long userId, String endpoint) {
        if (userId == null || endpoint == null || endpoint.isBlank()) return;
        repo.findByEndpoint(endpoint)
                .filter(s -> s.getUser().getId().equals(userId))
                .ifPresent(repo::delete);
    }
}
