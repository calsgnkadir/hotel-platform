package com.hotelapp.entity;

import com.hotelapp.enums.SubscriptionStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Faz 1 — İşletme aboneliği. Her işletmenin en fazla 1 kaydı (business_id unique).
 * Şema V12__subscriptions.sql ile birebir (ddl-auto=validate).
 */
@Entity
@Table(name = "subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false, unique = true)
    private Business business;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubscriptionStatus status;

    @Column(nullable = false, length = 40)
    private String plan;

    @Column(name = "trial_ends_at")
    private LocalDateTime trialEndsAt;

    @Column(name = "current_period_end")
    private LocalDateTime currentPeriodEnd;

    /** iyzico checkout form token (son başlatılan ödeme). */
    @Column(name = "last_checkout_token", length = 255)
    private String lastCheckoutToken;

    /** iyzico paymentId (başarılı son ödeme). */
    @Column(name = "last_payment_id", length = 64)
    private String lastPaymentId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
