package com.hotelapp.service;

import com.hotelapp.entity.AuditLog;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.AuditLogRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** KVKK: audit kaydina aktor e-postasi yazilmaz; admin listesi okuma aninda cozer. */
@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock private AuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private AuditLogService service;

    private static User user(Long id, String email, Role role) {
        return User.builder().id(id).email(email).role(role).build();
    }

    @Test
    @DisplayName("Kullanıcı eylemi: actorEmail kolonuna e-posta değil user:{id} yazılır, rol çözülür")
    void log_writesActorRefNotEmail() {
        when(userRepository.findById(5L)).thenReturn(Optional.of(user(5L, "admin@test.com", Role.ADMIN)));

        service.log(5L, "BAN_USER", "USER", 9L, "7 gün ban (userId=9)");

        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(cap.capture());
        AuditLog saved = cap.getValue();
        assertThat(saved.getActorId()).isEqualTo(5L);
        assertThat(saved.getActorEmail()).isEqualTo("user:5");
        assertThat(saved.getActorRole()).isEqualTo("ADMIN");
        assertThat(saved.getActorEmail() + saved.getDetails()).doesNotContain("@");
    }

    @Test
    @DisplayName("Aktör bulunamazsa da e-posta yok: user:{id}, rol ?")
    void log_unknownActor_stillRef() {
        when(userRepository.findById(5L)).thenReturn(Optional.empty());

        service.log(5L, "X", "USER", 1L, "d");

        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(cap.capture());
        assertThat(cap.getValue().getActorEmail()).isEqualTo("user:5");
        assertThat(cap.getValue().getActorRole()).isEqualTo("?");
    }

    @Test
    @DisplayName("Sistem eylemi: actorEmail SYSTEM kalır")
    void logSystem_keepsSystem() {
        service.logSystem("AUTO_BAN", "USER", 7L, "3 strike -> candidateId=7");

        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(cap.capture());
        assertThat(cap.getValue().getActorEmail()).isEqualTo("SYSTEM");
        verify(userRepository, never()).findById(any());
    }

    @Test
    @DisplayName("Admin listesi: user:{id} güncel e-postaya çözülür; eski kayıt ve SYSTEM olduğu gibi döner")
    void list_resolvesActorEmailAtReadTime() {
        LocalDateTime t = LocalDateTime.of(2026, 10, 25, 10, 0);
        AuditLog fresh = AuditLog.builder().id(1L).actorId(5L).actorEmail("user:5").actorRole("ADMIN")
                .action("BAN_USER").createdAt(t).build();
        AuditLog legacy = AuditLog.builder().id(2L).actorId(6L).actorEmail("eski@test.com").actorRole("ADMIN")
                .action("UNBAN_USER").createdAt(t).build();
        AuditLog system = AuditLog.builder().id(3L).actorEmail("SYSTEM").actorRole("SYSTEM")
                .action("AUTO_BAN").createdAt(t).build();
        AuditLog gone = AuditLog.builder().id(4L).actorId(8L).actorEmail("user:8").actorRole("CANDIDATE")
                .action("WITHDRAW_APPLICATION").createdAt(t).build();
        when(auditLogRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(fresh, legacy, system, gone)));
        when(userRepository.findAllById(any())).thenReturn(List.of(user(5L, "admin@test.com", Role.ADMIN)));

        var rows = service.list(null, 100);

        assertThat(rows).extracting(AuditLogService.AuditLogDto::getActorEmail)
                .containsExactly("admin@test.com", "eski@test.com", "SYSTEM", "user:8");
        assertThat(rows).extracting(AuditLogService.AuditLogDto::getActorId)
                .containsExactly(5L, 6L, null, 8L);
    }
}
