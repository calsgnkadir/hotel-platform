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
    void legacy_no_show_without_v25_rows_keeps_old_rule() {
        // V25 oncesi kayit: noShow=true, satir yok -> baslamis + girissiz vardiya "Gelmedi"
        // (no_show_is_marked ile ayni kural; burada gelecek vardiya Bekleniyor kalir).
        LocalDate future = LocalDate.now().plusDays(5);
        ShiftSlot later = ShiftSlot.builder().id(9L).date(future)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        Application a = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1, later);
        a.setNoShow(true);
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(a));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        Map<LocalDate, List<RosterRow>> rows = service.collectRows(listing(), null);

        assertThat(rows.get(D1).get(0).status()).isEqualTo("Gelmedi");
        assertThat(rows.get(future).get(0).status()).isEqualTo("Bekleniyor");
    }

    @Test
    void v25_no_show_row_only_marks_that_slot_and_stays_visible() {
        // QA regresyonu: QR kullanmayan isletme (hic giris kaydi yok). 2. gun isaretlendi;
        // 1. gun calisilmis vardiya "Gelmedi" olarak TURETILMEZ, isaretli satir yoklamada gorunur.
        Application a = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1, s2);
        a.setNoShow(true);
        a.getNoShowSlots().add(com.hotelapp.entity.ApplicationNoShowSlot.builder()
                .application(a).shiftSlot(s2).build());
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(a));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        Map<LocalDate, List<RosterRow>> rows = service.collectRows(listing(), null);

        assertThat(rows.get(D1)).singleElement().satisfies(r -> assertThat(r.status()).isNotEqualTo("Gelmedi"));
        assertThat(rows.get(D2)).singleElement().satisfies(r -> {
            assertThat(r.status()).isEqualTo("Gelmedi");
            assertThat(r.shiftSlotId()).isEqualTo(2L);
            assertThat(r.canCheckIn()).isFalse();
        });
    }

    @Test
    void staff_list_drops_no_show_from_that_shift_only_and_standby_replaces_it() throws Exception {
        // Karar 2: Ayşe 2. gün gelmedi; yedek Mert aynı vardiyaya kabul edildi.
        // Ekip listesinde (Excel/e-posta) o vardiyada yalnız Mert; Ayşe 1. gün kadroda kalır.
        // Yoklamada (collectRows) Ayşe'nin "Gelmedi" satırı kayıt olarak görünmeye devam eder.
        Application ayse = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s1, s2);
        ayse.setNoShow(true);
        ayse.getNoShowSlots().add(com.hotelapp.entity.ApplicationNoShowSlot.builder()
                .application(ayse).shiftSlot(s2).build());
        Application mert = app(2, "Mert", ApplicationStatus.ACCEPTED, s2);
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing()));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(ayse, mert));
        lenient().when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(anyLong())).thenReturn(List.of());

        Map<LocalDate, List<RosterRow>> staff = service.collectStaffRows(listing(), null);
        assertThat(staff.get(D1)).extracting(RosterRow::fullName).containsExactly("Ayşe");
        assertThat(staff.get(D2)).extracting(RosterRow::fullName).containsExactly("Mert");
        assertThat(staff.values().stream().flatMap(List::stream))
                .noneMatch(r -> "Gelmedi".equals(r.status()));

        Map<LocalDate, List<RosterRow>> attendance = service.collectRows(listing(), D2);
        assertThat(attendance.get(D2)).extracting(RosterRow::fullName, RosterRow::status)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Ayşe", "Gelmedi"),
                        org.assertj.core.groups.Tuple.tuple("Mert", "Bekleniyor"));

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(service.buildForOwner(10L, 7L, D2)))) {
            Sheet sh = wb.getSheet("04.10.2026");
            assertThat(sh.getRow(1).getCell(0).getStringCellValue()).contains("1 kişi");
            assertThat(sh.getRow(4).getCell(1).getStringCellValue()).isEqualTo("Mert");
            assertThat(sh.getRow(5)).isNull();
        }
    }

    @Test
    void staff_list_for_day_with_only_no_show_is_empty_so_no_email() {
        Application ayse = app(1, "Ayşe", ApplicationStatus.ACCEPTED, s2);
        ayse.setNoShow(true);
        ayse.getNoShowSlots().add(com.hotelapp.entity.ApplicationNoShowSlot.builder()
                .application(ayse).shiftSlot(s2).build());
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing()));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(ayse));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        assertThat(service.xlsxForDateOrNull(10L, D2)).isNull();
    }

    @Test
    void other_owner_cannot_download() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing()));

        assertThatThrownBy(() -> service.buildForOwner(10L, 999L, null))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void midnight_entry_belongs_to_night_shift_in_roster_and_excel() throws Exception {
        ShiftSlot night = ShiftSlot.builder().id(3L).date(D1)
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        ShiftSlot morning = ShiftSlot.builder().id(4L).date(D2)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        when(applicationRepository.findAllByJobListingId(10L))
                .thenReturn(List.of(app(1, "Ayşe", ApplicationStatus.ACCEPTED, night, morning)));
        // Check both historical (no slot) and new explicit slot records.
        for (Long slotId : java.util.Arrays.asList(null, 3L)) {
            when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                    WorkSession.builder().shiftSlotId(slotId).clockInAt(D2.atTime(0, 10)).build()));
            var rows = service.collectRows(listing(), null);
            assertThat(rows.get(D1).get(0).clockIn()).isEqualTo("00:10");
            assertThat(rows.get(D2).get(0).clockIn()).isEmpty();
            try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(service.toXlsx(listing(), rows)))) {
                assertThat(wb.getSheet("03.10.2026").getRow(4).getCell(4).getStringCellValue()).isEqualTo("00:10");
                assertThat(wb.getSheet("04.10.2026").getRow(4).getCell(4).getStringCellValue()).isEmpty();
            }
        }
    }
}
