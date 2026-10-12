package com.hotelapp.repository;

import com.hotelapp.entity.PaymentCheckout;
import com.hotelapp.enums.PaymentCheckoutStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentCheckoutRepository extends JpaRepository<PaymentCheckout, Long> {

    /** Callback ve mutabakat aynı oturumu aynı anda işlemesin (çift uzatma yok). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PaymentCheckout p WHERE p.token = :token")
    Optional<PaymentCheckout> findByTokenForUpdate(@Param("token") String token);

    /** Mutabakat: belirli andan eski bekleyen oturumlar (en eskiden başlayarak). */
    List<PaymentCheckout> findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
            PaymentCheckoutStatus status, LocalDateTime before);
}
