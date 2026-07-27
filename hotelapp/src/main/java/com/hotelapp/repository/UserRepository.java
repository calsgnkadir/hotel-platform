package com.hotelapp.repository;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findAllByRole(Role role);

    long countByRole(Role role);

    // Şu an banlı (bannedUntil > now) kullanıcı sayısı
    @Query("SELECT COUNT(u) FROM User u WHERE u.bannedUntil IS NOT NULL AND u.bannedUntil > :now")
    long countCurrentlyBanned(LocalDateTime now);

    // Admin arama — email VEYA fullName içeren, opsiyonel role filtresi
    @Query("""
        SELECT u FROM User u
        WHERE (:role IS NULL OR u.role = :role)
        AND (:search IS NULL OR :search = ''
             OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY u.id DESC
    """)
    List<User> searchUsers(Role role, String search);

    /**
     * ADIM J: Bir ilçe + pozisyon kombinasyonu için tercih eşleşmesi olan adayları getir.
     * Aday CANDIDATE rolünde + ilçesi tercihinde + pozisyonu tercihinde olmalı.
     * Tercihleri boş olanlar bildirilmez (opt-in).
     */
    @Query("""
        SELECT DISTINCT u FROM User u
        JOIN u.preferredDistricts d
        JOIN u.preferredPositions p
        WHERE u.role = com.hotelapp.enums.Role.CANDIDATE
        AND d = :district
        AND p = :position
    """)
    List<User> findCandidatesMatchingPreferences(
            @Param("district") String district,
            @Param("position") Position position);

    /**
     * FAZ C.2 — "Hemen müsait" havuzu: acil ilan push'u için hedef adaylar.
     *
     * Filtreler:
     *  - availableUntil > now  → zaman kutulu müsaitlik hâlâ geçerli
     *  - banlı değil           → cezalı adaya acil iş gönderilmez
     *  - pozisyon tercihi ya ilanla eşleşiyor YA DA aday hiç tercih girmemiş
     *    (tercih girmemiş aday her şeye açık sayılır — "hemen müsaitim"
     *     demiş olması zaten güçlü bir sinyal, onu havuzdan düşürmek yanlış olur)
     *
     * NOT: Mesafeye göre daraltma YOK — adayın sunucu tarafında konum verisi
     * yok (FAZ B.5.2'de ilçe kaldırıldı, lat/lng hiç olmadı). Mesafe yalnızca
     * tarayıcıda, adayın kendi konumuyla hesaplanıyor.
     */
    @Query("""
        SELECT DISTINCT u FROM User u
        WHERE u.role = com.hotelapp.enums.Role.CANDIDATE
          AND u.availableUntil IS NOT NULL
          AND u.availableUntil > :now
          AND (u.bannedUntil IS NULL OR u.bannedUntil <= :now)
          AND (u.preferredPositions IS EMPTY OR :position MEMBER OF u.preferredPositions)
    """)
    List<User> findAvailableNowCandidates(
            @Param("now") LocalDateTime now,
            @Param("position") Position position);

    /** FAZ C.2 — Havuz büyüklüğü (işletmeye "N aday hemen müsait" göstergesi). */
    @Query("""
        SELECT COUNT(DISTINCT u) FROM User u
        WHERE u.role = com.hotelapp.enums.Role.CANDIDATE
          AND u.availableUntil IS NOT NULL
          AND u.availableUntil > :now
          AND (u.bannedUntil IS NULL OR u.bannedUntil <= :now)
    """)
    long countAvailableNowCandidates(@Param("now") LocalDateTime now);

    /**
     * FAZ J2 ext: Müsaitlik bloğu tanımlamış tüm CANDIDATE'lar.
     * district/position tercihi olmayanlar da listelenir — eşleşme JobListingService
     * tarafında candidateFitsListingSlots ile filtrelenir.
     */
    @Query("""
        SELECT DISTINCT u FROM User u
        WHERE u.role = com.hotelapp.enums.Role.CANDIDATE
        AND EXISTS (
            SELECT 1 FROM UserAvailabilityBlock b WHERE b.user.id = u.id
        )
    """)
    List<User> findCandidatesWithAvailabilityBlocks();

    /** FAZ D.8 — Anonymize cutoff'u gecmis pending deletion'lar. */
    List<User> findAllByScheduledAnonymizeAtBefore(LocalDateTime now);
}
