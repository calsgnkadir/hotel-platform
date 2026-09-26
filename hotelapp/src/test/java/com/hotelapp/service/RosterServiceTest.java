package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.service.RosterService.RosterRow;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RosterServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private WorkSessionRepository workSessionRepository;
    @InjectMocks private RosterService service;

    private static final LocalDate D1 = LocalDate.of(2026, 10, 3);
    private static final LocalDate D2 = LocalDate.of(2026, 10, 4);

    private final ShiftSlot s1 = ShiftSlot.builder().id(1L).date(D1)
            .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
    private final ShiftSlot s2 = ShiftSlot.builder().id(2L).date(D2)
            .startTime(LocalTime.of(16, 0)).endTime(LocalTime.of(23, 0)).build();

    private JobListing listing() {
        User owner = User.builder().id(7L).fullName("Otel Sahibi").build();
        Business b = Business.builder().id(3L).name("Grand Otel").owner(owner).build();
        return JobListing.builder().id(10L).title("Banket garsonu").business(b).build();
    }

    private Application app(long id, String name, ApplicationStatus st, ShiftSlot... slots) {
        return Application.builder().id(id).status(st)
                .candidate(User.builder().id(100 + id).fullName(name).phone("0555 000 00 0" + id).build())
                .requestedSlots(new HashSet<>(Set.of(slots)))
                .build();
    }

    @Test
    void groups_accepted_candidates_by_shift_day_with_attendance() {
        Application ayse = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1, s2);
        Application mert = app(2, "Mert", ApplicationStatus.ACCEPTED, s1);
        Application pending = app(3, "Bekleyen", ApplicationStatus.PENDING, s1);
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(mert, pending, ayse));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                WorkSession.builder().clockInAt(D1.atTime(7, 55)).clockOutAt(D1.atTime(16, 5)).build()));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(2L)).thenReturn(List.of());

        Map<LocalDate, List<RosterRow>> rows = service.collectRows(listing(), null);

        assertThat(rows.keySet()).containsExactly(D1, D2);
        assertThat(rows.get(D1)).extracting(RosterRow::fullName).containsExactly("Ayşe", "Mert");
        RosterRow ayseD1 = rows.get(D1).get(0);
        assertThat(ayseD1.shift()).isEqualTo("08:00 – 16:00");
        assertThat(ayseD1.clockIn()).isEqualTo("07:55");
        assertThat(ayseD1.clockOut()).isEqualTo("16:05");
        assertThat(ayseD1.status()).isEqualTo("Tamamladı");
        assertThat(rows.get(D1).get(1).status()).isEqualTo("Bekleniyor");
        assertThat(rows.get(D2)).extracting(RosterRow::fullName).containsExactly("Ayşe");
    }

    @Test
    void single_day_filter_and_xlsx_has_one_sheet_per_day() throws Exception {
        Application ayse = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1, s2);
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing()));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(ayse));
        lenient().when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(anyLong())).thenReturn(List.of());

        byte[] all = service.buildForOwner(10L, 7L, null);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(all))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(2);
            Sheet first = wb.getSheetAt(0);
            assertThat(first.getSheetName()).isEqualTo("03.10.2026");
            assertThat(first.getRow(3).getCell(7).getStringCellValue()).isEqualTo("İmza");
            assertThat(first.getRow(4).getCell(1).getStringCellValue()).isEqualTo("Ayşe");
        }

        assertThat(service.xlsxForDateOrNull(10L, D2)).isNotNull();
        assertThat(service.xlsxForDateOrNull(10L, LocalDate.of(2026, 10, 9))).isNull();
    }

    @Test
    void no_show_is_marked() {
        Application a = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1);
        a.setNoShow(true);
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(a));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        assertThat(service.collectRows(listing(), D1).get(D1).get(0).status()).isEqualTo("Gelmedi");
    }

    @Test
    void other_owner_cannot_download() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing()));

        assertThatThrownBy(() -> service.buildForOwner(10L, 999L, null))
                .isInstanceOf(UnauthorizedException.class);
    }
}
