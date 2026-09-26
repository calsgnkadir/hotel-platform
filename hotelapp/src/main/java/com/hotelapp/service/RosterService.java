package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.WorkSessionRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Ekip listesi (.xlsx) — ajansların otele verdiği günlük kadro/imza listesinin
 * karşılığı. Her vardiya günü ayrı sayfa; satır = o gün çalışacak (kabul
 * edilmiş) aday. Giriş/çıkış saatleri mesai kaydından (WorkSession) gelir;
 * "İmza" sütunu çıktı alınıp sahada imzalatmak için boş bırakılır.
 *
 * KVKK: sadece koordinasyon için gerekenler (ad, telefon). TC/adres yok.
 */
@Service
@RequiredArgsConstructor
public class RosterService {

    private static final DateTimeFormatter D  = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter T  = DateTimeFormatter.ofPattern("HH:mm");
    private static final String[] HEADERS =
            { "#", "Ad Soyad", "Telefon", "Vardiya", "Giriş", "Çıkış", "Durum", "İmza" };

    private final JobListingRepository jobListingRepository;
    private final ApplicationRepository applicationRepository;
    private final WorkSessionRepository workSessionRepository;

    /** Satır verisi (xlsx'ten bağımsız — test edilebilir). */
    public record RosterRow(String fullName, String phone, String shift,
                            String clockIn, String clockOut, String status) {}

    /** İşletme sahibinin kendi ilanı için tam liste (date null → tüm günler). */
    @Transactional(readOnly = true)
    public byte[] buildForOwner(Long listingId, Long ownerId, LocalDate onlyDate) {
        JobListing listing = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        if (!listing.getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu ilanın listesini indiremezsin");
        }
        return toXlsx(listing, collectRows(listing, onlyDate));
    }

    /** Scheduler için: o günün listesi; o gün kimse yoksa null (e-posta atılmaz). */
    @Transactional(readOnly = true)
    public byte[] xlsxForDateOrNull(Long listingId, LocalDate date) {
        JobListing listing = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        Map<LocalDate, List<RosterRow>> rows = collectRows(listing, date);
        return rows.isEmpty() ? null : toXlsx(listing, rows);
    }

    /** Gün → satırlar (tarih sıralı). Vardiyası belli olmayan eski başvurular "Tarihsiz"e. */
    Map<LocalDate, List<RosterRow>> collectRows(JobListing listing, LocalDate onlyDate) {
        List<Application> accepted = applicationRepository.findAllByJobListingId(listing.getId()).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .sorted(Comparator.comparing(a -> a.getCandidate().getFullName(),
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        Map<LocalDate, List<RosterRow>> byDate = new TreeMap<>(Comparator.nullsLast(Comparator.naturalOrder()));
        for (Application a : accepted) {
            List<WorkSession> sessions = workSessionRepository.findByApplicationIdOrderByClockInAtDesc(a.getId());
            List<ShiftSlot> slots = a.getRequestedSlots().isEmpty()
                    ? List.of()
                    : a.getRequestedSlots().stream()
                        .sorted(Comparator.comparing(ShiftSlot::getDate).thenComparing(ShiftSlot::getStartTime))
                        .toList();

            if (slots.isEmpty()) {
                if (onlyDate == null) {
                    byDate.computeIfAbsent(null, k -> new ArrayList<>()).add(row(a, "—", null, a.isNoShow()));
                }
                continue;
            }
            for (ShiftSlot s : slots) {
                if (onlyDate != null && !onlyDate.equals(s.getDate())) continue;
                WorkSession ws = sessions.stream()
                        .filter(x -> x.getClockInAt() != null && x.getClockInAt().toLocalDate().equals(s.getDate()))
                        .findFirst().orElse(null);
                String shift = T.format(s.getStartTime()) + " – " + T.format(s.getEndTime());
                byDate.computeIfAbsent(s.getDate(), k -> new ArrayList<>()).add(row(a, shift, ws, a.isNoShow()));
            }
        }
        return byDate;
    }

    private RosterRow row(Application a, String shift, WorkSession ws, boolean noShow) {
        String in  = ws != null && ws.getClockInAt()  != null ? T.format(ws.getClockInAt())  : "";
        String out = ws != null && ws.getClockOutAt() != null ? T.format(ws.getClockOutAt()) : "";
        String status = noShow ? "Gelmedi"
                : ws == null ? "Bekleniyor"
                : ws.getClockOutAt() == null ? "İşte" : "Tamamladı";
        String phone = a.getCandidate().getPhone();
        return new RosterRow(a.getCandidate().getFullName(), phone == null ? "" : phone, shift, in, out, status);
    }

    byte[] toXlsx(JobListing listing, Map<LocalDate, List<RosterRow>> byDate) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            CellStyle title = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            bold.setFontHeightInPoints((short) 13);
            title.setFont(bold);

            CellStyle head = wb.createCellStyle();
            Font headFont = wb.createFont();
            headFont.setBold(true);
            headFont.setColor(IndexedColors.WHITE.getIndex());
            head.setFont(headFont);
            head.setFillForegroundColor(IndexedColors.GREY_80_PERCENT.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle cell = wb.createCellStyle();
            cell.setBorderBottom(BorderStyle.THIN);
            cell.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());

            Map<LocalDate, List<RosterRow>> data = byDate.isEmpty()
                    ? new LinkedHashMap<>(Map.of(LocalDate.MIN, List.of()))
                    : byDate;
            for (Map.Entry<LocalDate, List<RosterRow>> e : data.entrySet()) {
                LocalDate date = e.getKey();
                String sheetName = date == null ? "Tarihsiz"
                        : date.equals(LocalDate.MIN) ? "Liste" : D.format(date);
                Sheet sh = wb.createSheet(sheetName);

                Row r0 = sh.createRow(0);
                Cell c0 = r0.createCell(0);
                c0.setCellValue(listing.getBusiness().getName() + " — " + listing.getTitle());
                c0.setCellStyle(title);
                sh.createRow(1).createCell(0).setCellValue(
                        (date == null || date.equals(LocalDate.MIN) ? "" : D.format(date) + " · ")
                        + e.getValue().size() + " kişi · Oluşturma: "
                        + DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").format(LocalDateTime.now())
                        + " · Kadrom");

                Row h = sh.createRow(3);
                for (int i = 0; i < HEADERS.length; i++) {
                    Cell hc = h.createCell(i);
                    hc.setCellValue(HEADERS[i]);
                    hc.setCellStyle(head);
                }
                int n = 0;
                for (RosterRow rr : e.getValue()) {
                    Row r = sh.createRow(4 + n);
                    String[] vals = { String.valueOf(n + 1), rr.fullName(), rr.phone(), rr.shift(),
                                      rr.clockIn(), rr.clockOut(), rr.status(), "" };
                    for (int i = 0; i < vals.length; i++) {
                        Cell c = r.createCell(i);
                        c.setCellValue(vals[i]);
                        c.setCellStyle(cell);
                    }
                    r.setHeightInPoints(22);  // imza için yer
                    n++;
                }
                int[] widths = { 5, 26, 16, 15, 8, 8, 12, 22 };
                for (int i = 0; i < widths.length; i++) sh.setColumnWidth(i, widths[i] * 256);
                sh.createFreezePane(0, 4);
            }
            wb.write(bos);
            return bos.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Excel oluşturulamadı", ex);
        }
    }
}
