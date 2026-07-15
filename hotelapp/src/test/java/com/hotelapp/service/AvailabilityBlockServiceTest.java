package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.entity.UserAvailabilityBlock;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.UserAvailabilityBlockRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.AvailabilityBlockService.AvailabilityBlockDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AvailabilityBlockServiceTest {

    @Mock private UserAvailabilityBlockRepository blockRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private AvailabilityBlockService service;

    private static final Long USER_ID = 7L;

    @Test
    @DisplayName("getMyBlocks: repo'dan gelen entityleri DTO'ya çevirir")
    void getMyBlocks_mapsEntities() {
        when(blockRepository.findByUserIdOrderByDayOfWeekAscStartTimeAsc(USER_ID))
                .thenReturn(List.of(
                        block(1L, DayOfWeek.MONDAY, 9, 17),
                        block(2L, DayOfWeek.FRIDAY, 14, 22)
                ));

        List<AvailabilityBlockDto> dtos = service.getMyBlocks(USER_ID);

        assertThat(dtos).hasSize(2);
        assertThat(dtos.get(0).getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(dtos.get(0).getStartTime()).isEqualTo(LocalTime.of(9, 0));
        assertThat(dtos.get(1).getDayOfWeek()).isEqualTo(DayOfWeek.FRIDAY);
    }

    @Test
    @DisplayName("replaceMyBlocks: önce siler, sonra yenilerini kaydeder")
    void replaceMyBlocks_atomicReplace() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(testUser()));
        when(blockRepository.findByUserIdOrderByDayOfWeekAscStartTimeAsc(USER_ID))
                .thenReturn(List.of(block(10L, DayOfWeek.TUESDAY, 8, 16)));

        List<AvailabilityBlockDto> input = List.of(
                dto(DayOfWeek.TUESDAY, 8, 16)
        );

        service.replaceMyBlocks(USER_ID, input);

        verify(blockRepository).deleteAllByUserId(USER_ID);
        verify(blockRepository).flush();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserAvailabilityBlock>> captor = ArgumentCaptor.forClass(List.class);
        verify(blockRepository).saveAll(captor.capture());
        List<UserAvailabilityBlock> saved = captor.getValue();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getDayOfWeek()).isEqualTo(DayOfWeek.TUESDAY);
        assertThat(saved.get(0).getStartTime()).isEqualTo(LocalTime.of(8, 0));
    }

    @Test
    @DisplayName("replaceMyBlocks: boş liste de geçerlidir (tüm bloklar silinir)")
    void replaceMyBlocks_emptyList_isValid() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(testUser()));
        when(blockRepository.findByUserIdOrderByDayOfWeekAscStartTimeAsc(USER_ID))
                .thenReturn(List.of());

        List<AvailabilityBlockDto> result = service.replaceMyBlocks(USER_ID, List.of());

        assertThat(result).isEmpty();
        verify(blockRepository).deleteAllByUserId(USER_ID);
        verify(blockRepository).saveAll(List.of());
    }

    @Test
    @DisplayName("Limit aşımı: 21 blok BusinessRuleException atar")
    void replaceMyBlocks_tooManyBlocks_throws() {
        List<AvailabilityBlockDto> tooMany = IntStream.range(0, 21)
                .mapToObj(i -> dto(DayOfWeek.MONDAY, 9, 10))
                .collect(Collectors.toList());

        assertThatThrownBy(() -> service.replaceMyBlocks(USER_ID, tooMany))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("error.availability.maxBlocks");

        verify(blockRepository, never()).deleteAllByUserId(anyLong());
    }

    @Test
    @DisplayName("Geçersiz aralık: start >= end → BusinessRuleException")
    void replaceMyBlocks_startAfterEnd_throws() {
        List<AvailabilityBlockDto> invalid = List.of(
                dto(DayOfWeek.MONDAY, 17, 9)  // ters
        );

        assertThatThrownBy(() -> service.replaceMyBlocks(USER_ID, invalid))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("önce olmalı");

        verify(blockRepository, never()).deleteAllByUserId(anyLong());
    }

    @Test
    @DisplayName("Null gün: BusinessRuleException")
    void replaceMyBlocks_nullDay_throws() {
        AvailabilityBlockDto bad = AvailabilityBlockDto.builder()
                .dayOfWeek(null)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(17, 0))
                .build();

        assertThatThrownBy(() -> service.replaceMyBlocks(USER_ID, List.of(bad)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("error.application.slotRequired");
    }

    @Test
    @DisplayName("Null saat: BusinessRuleException")
    void replaceMyBlocks_nullTime_throws() {
        AvailabilityBlockDto bad = AvailabilityBlockDto.builder()
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(null)
                .endTime(LocalTime.of(17, 0))
                .build();

        assertThatThrownBy(() -> service.replaceMyBlocks(USER_ID, List.of(bad)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("zorunlu");
    }

    @Test
    @DisplayName("Kullanıcı bulunamazsa ResourceNotFoundException")
    void replaceMyBlocks_userNotFound_throws() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        List<AvailabilityBlockDto> input = List.of(dto(DayOfWeek.MONDAY, 9, 17));

        assertThatThrownBy(() -> service.replaceMyBlocks(USER_ID, input))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    private static UserAvailabilityBlock block(Long id, DayOfWeek day, int startHour, int endHour) {
        return UserAvailabilityBlock.builder()
                .id(id)
                .dayOfWeek(day)
                .startTime(LocalTime.of(startHour, 0))
                .endTime(LocalTime.of(endHour, 0))
                .build();
    }

    private static AvailabilityBlockDto dto(DayOfWeek day, int startHour, int endHour) {
        return AvailabilityBlockDto.builder()
                .dayOfWeek(day)
                .startTime(LocalTime.of(startHour, 0))
                .endTime(LocalTime.of(endHour, 0))
                .build();
    }

    private static User testUser() {
        return User.builder().id(USER_ID).email("aday@test.com").build();
    }
}
