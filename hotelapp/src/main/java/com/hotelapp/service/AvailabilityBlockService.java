package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.entity.UserAvailabilityBlock;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.UserAvailabilityBlockRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

/**
 * Faz B/#10 — Aday'ın profil bazlı haftalık müsaitlik blokları.
 *
 * Bloklar tek atomik PUT ile değiştirilir: önce hepsi silinir, sonra yeni liste insert
 * edilir. Bu hem basit hem de "form Submit"e doğal eşleşir (frontend tüm satırları
 * gönderir, backend snapshot olarak alır).
 */
@Service
@RequiredArgsConstructor
public class AvailabilityBlockService {

    private final UserAvailabilityBlockRepository blockRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AvailabilityBlockDto> getMyBlocks(Long userId) {
        return blockRepository.findByUserIdOrderByDayOfWeekAscStartTimeAsc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public List<AvailabilityBlockDto> replaceMyBlocks(Long userId, @Valid List<@Valid AvailabilityBlockDto> blocks) {
        if (blocks.size() > 20) {
            throw BusinessRuleException.keyed("error.availability.maxBlocks");
        }
        // Her blok için from < to kontrolü
        for (var b : blocks) {
            if (b.getStartTime() == null || b.getEndTime() == null) {
                throw new BusinessRuleException("Başlangıç ve bitiş saati zorunlu");
            }
            if (!b.getStartTime().isBefore(b.getEndTime())) {
                throw new BusinessRuleException("Başlangıç saati bitiş saatinden önce olmalı");
            }
            if (b.getDayOfWeek() == null) {
                throw BusinessRuleException.keyed("error.application.slotRequired");
            }
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı"));

        blockRepository.deleteAllByUserId(userId);
        blockRepository.flush();

        List<UserAvailabilityBlock> entities = blocks.stream()
                .map(dto -> UserAvailabilityBlock.builder()
                        .user(user)
                        .dayOfWeek(dto.getDayOfWeek())
                        .startTime(dto.getStartTime())
                        .endTime(dto.getEndTime())
                        .build())
                .toList();
        blockRepository.saveAll(entities);

        return getMyBlocks(userId);
    }

    private AvailabilityBlockDto toDto(UserAvailabilityBlock b) {
        return AvailabilityBlockDto.builder()
                .id(b.getId())
                .dayOfWeek(b.getDayOfWeek())
                .startTime(b.getStartTime())
                .endTime(b.getEndTime())
                .build();
    }

    @Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AvailabilityBlockDto {
        private Long id;  // PUT'ta null olabilir (yeni satır)

        @NotNull(message = "Gün zorunlu")
        private DayOfWeek dayOfWeek;

        @NotNull(message = "Başlangıç saati zorunlu")
        private LocalTime startTime;

        @NotNull(message = "Bitiş saati zorunlu")
        private LocalTime endTime;
    }
}
