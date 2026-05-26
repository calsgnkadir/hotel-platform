package com.hotelapp.repository;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
}
