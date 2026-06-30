package com.hotelapp.controller;

import com.hotelapp.entity.SavedSearch;
import com.hotelapp.enums.Shift;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.SavedSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * FAZ 5 — Kayıtlı arama REST endpoint'leri (sadece authenticated kullanıcılar).
 */
@RestController
@RequestMapping("/api/saved-searches")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SavedSearchController {

    private final SavedSearchService service;

    @PostMapping
    public ResponseEntity<SavedSearchDto> create(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody SavedSearchService.CreatePayload payload
    ) {
        SavedSearch s = service.create(currentUser.getId(), payload);
        return ResponseEntity.ok(SavedSearchDto.from(s));
    }

    @GetMapping
    public List<SavedSearchDto> list(@AuthenticationPrincipal UserPrincipal currentUser) {
        return service.listMine(currentUser.getId()).stream()
                .map(SavedSearchDto::from)
                .toList();
    }

    @PatchMapping("/{id}")
    public SavedSearchDto update(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id,
            @RequestBody SavedSearchService.UpdatePayload payload
    ) {
        return SavedSearchDto.from(service.update(currentUser.getId(), id, payload));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id
    ) {
        service.delete(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    /** Salt-okunur DTO: entity'nin user FK'sini dışarı sızdırma. */
    public record SavedSearchDto(
            Long id,
            String name,
            String position,
            String jobType,
            String district,
            String keyword,
            java.math.BigDecimal minSalary,
            LocalDate dateFrom,
            LocalDate dateTo,
            Set<Shift> shifts,
            boolean notificationsEnabled,
            LocalDateTime lastNotifiedAt,
            LocalDateTime createdAt
    ) {
        static SavedSearchDto from(SavedSearch s) {
            return new SavedSearchDto(
                    s.getId(),
                    s.getName(),
                    s.getPosition() != null ? s.getPosition().name() : null,
                    s.getJobType()  != null ? s.getJobType().name()  : null,
                    s.getDistrict(),
                    s.getKeyword(),
                    s.getMinSalary(),
                    s.getDateFrom(),
                    s.getDateTo(),
                    s.getShifts(),
                    s.isNotificationsEnabled(),
                    s.getLastNotifiedAt(),
                    s.getCreatedAt()
            );
        }
    }
}
