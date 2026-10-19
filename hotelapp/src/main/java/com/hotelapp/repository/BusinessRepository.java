package com.hotelapp.repository;

import com.hotelapp.entity.Business;
import com.hotelapp.enums.BusinessType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BusinessRepository extends JpaRepository<Business, Long> {
    Optional<Business> findByOwnerId(Long ownerId);

    /**
     * Ilan kotasi: ayni isletmenin eszamanli ilan yayinlama istekleri bu satir kilidinde
     * sirayla islenir (iki istek ayni anda "4 < 5" gorup 6. aktif ilani acamasin).
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT b FROM Business b WHERE b.id = :id")
    Optional<Business> lockById(@org.springframework.data.repository.query.Param("id") Long id);
    List<Business> findAllByType(BusinessType type);
    boolean existsByOwnerId(Long ownerId);
}
