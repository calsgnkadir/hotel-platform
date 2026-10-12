package com.hotelapp.entity;

import com.hotelapp.enums.PaymentCheckoutStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * iyzico hosted checkout oturumu — her "Aboneliği başlat" bir kayıt.
 * Şema V23__payment_checkouts ile birebir (ddl-auto=validate).
 *
 * Eskiden token Subscription.lastCheckoutToken tek alanında tutuluyordu; ikinci
 * checkout birincinin üzerine yazıyor, ödenmiş ilk oturumun callback'i
 * eşleşmiyordu. Artık her oturum ayrı ve mutabakat işi bekleyenleri tarar.
 */
@Entity
@Table(name = "payment_checkouts",
        uniqueConstraints = @UniqueConstraint(name = "uk_payment_checkouts_token", columnNames = "token"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentCheckout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(name = "token", nullable = false, length = 255)
    private String token;

    /** Bizim ürettiğimiz iyzico conversationId — dönüşte birebir doğrulanır. */
    @Column(name = "conversation_id", nullable = false, length = 64)
    private String conversationId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private PaymentCheckoutStatus status = PaymentCheckoutStatus.PENDING;

    @Column(name = "expected_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal expectedPrice;

    @Column(name = "paid_price", precision = 10, scale = 2)
    private BigDecimal paidPrice;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = PaymentCheckoutStatus.PENDING;
    }
}
