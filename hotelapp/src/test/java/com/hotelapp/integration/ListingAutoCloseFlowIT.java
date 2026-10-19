package com.hotelapp.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Notification;
import com.hotelapp.enums.*;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import com.hotelapp.service.ListingAutoCloseScheduler;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Uçtan uca: ilan son vardiyası bitince otomatik kapanır; açık başvurular EXPIRED,
 * ACCEPTED ve koltuk sayacı aynı; adaya tek bildirim; ikinci koşu idempotent;
 * kapanan ilan kotaya sayılmaz. Manuel kapanış da açık başvuruları sonuçlandırır.
 *
 * <p>Arka plan zamanlayıcısı da (gerçek saatle) aynı ilanı kapatabilir; doğrulamalar
 * bu yüzden kapanışı kimin yaptığına değil son duruma ve bildirim sayısına bakar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingAutoCloseFlowIT {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private ShiftSlotRepository shiftSlotRepository;
    @Autowired private JobListingRepository jobListingRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private ListingAutoCloseScheduler scheduler;

    @Test
    void endedListing_autoCloses_expiresOpenApplications_notifiesOnce_andFreesQuota() throws Exception {
        LocalDate today = LocalDate.now(TR);
        String biz = register(business("ac-biz@app.com"));
        Long ended = createListing(biz, slot(today.plusDays(3), "09:00", "17:00", 2));
        Long future = createListing(biz, slot(today.plusDays(5), "09:00", "17:00", 2));
        Long endedSlot = firstSlotId(ended, biz);
        Long futureSlot = firstSlotId(future, biz);

        String c1 = register(candidate("ac-c1@app.com"));
        String c2 = register(candidate("ac-c2@app.com"));
        String c3 = register(candidate("ac-c3@app.com"));
        String c4 = register(candidate("ac-c4@app.com"));
        String c5 = register(candidate("ac-c5@app.com"));
        Long accepted = apply(c1, ended, endedSlot);
        Long held = apply(c2, ended, endedSlot);
        Long standby = apply(c3, ended, endedSlot);
        Long reviewing = apply(c4, ended, endedSlot);
        Long pending = apply(c5, ended, endedSlot);
        Long otherListingApp = apply(c5, future, futureSlot);

        decide(biz, accepted, ApplicationStatus.ACCEPTED).andExpect(status().isOk());
        mvc.perform(put("/api/business/applications/" + held + "/hold")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk());
        Application sb = applicationRepository.findById(standby).orElseThrow();
        sb.setStatus(ApplicationStatus.STANDBY);
        sb.setStandbyRank(1);
        sb.setStandbyOfferedAt(LocalDateTime.now(TR));
        sb.setStandbyDeadline(LocalDateTime.now(TR).plusHours(1));
        applicationRepository.save(sb);
        Application rv = applicationRepository.findById(reviewing).orElseThrow();
        rv.setStatus(ApplicationStatus.REVIEWING);
        applicationRepository.save(rv);
        assertThat(applicationRepository.findById(held).orElseThrow().getHoldDeadline()).isNotNull();

        Long bizId = jobListingRepository.findById(ended).orElseThrow().getBusiness().getId();
        assertThat(jobListingRepository.countByBusiness_IdAndStatusNot(bizId, ListingStatus.CLOSED)).isEqualTo(2);

        // Son (tek) vardiya iki gün önce bitti
        var s = shiftSlotRepository.findById(endedSlot).orElseThrow();
        s.setDate(today.minusDays(2));
        shiftSlotRepository.save(s);

        scheduler.closeEndedListings(LocalDateTime.now(TR));

        assertThat(jobListingRepository.findById(ended).orElseThrow().getStatus()).isEqualTo(ListingStatus.CLOSED);
        assertThat(jobListingRepository.findById(future).orElseThrow().getStatus()).isEqualTo(ListingStatus.ACTIVE);

        assertThat(applicationRepository.findById(accepted).orElseThrow().getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        for (Long id : List.of(held, standby, reviewing, pending)) {
            assertThat(applicationRepository.findById(id).orElseThrow().getStatus())
                    .as("başvuru %d", id).isEqualTo(ApplicationStatus.EXPIRED);
        }
        Application heldAfter = applicationRepository.findById(held).orElseThrow();
        assertThat(heldAfter.getHoldDeadline()).isNull();
        Application sbAfter = applicationRepository.findById(standby).orElseThrow();
        assertThat(sbAfter.getStandbyRank()).isNull();
        assertThat(sbAfter.getStandbyOfferedAt()).isNull();
        assertThat(sbAfter.getStandbyDeadline()).isNull();
        assertThat(applicationRepository.findById(otherListingApp).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.PENDING);
        // Koltuk sayacı değişmez (yalnız ACCEPTED koltuk tutar)
        assertThat(shiftSlotRepository.findById(endedSlot).orElseThrow().getSlotsFilled()).isEqualTo(1);

        // Kapanan ilan kotaya sayılmaz
        assertThat(jobListingRepository.countByBusiness_IdAndStatusNot(bizId, ListingStatus.CLOSED)).isEqualTo(1);

        // Açık başvurusu olan her adaya tek bildirim; kabul edilen adaya yok
        for (Long appId : List.of(held, standby, reviewing, pending)) {
            List<Notification> n = awaitClosedNotifications(candidateId(appId), 1);
            assertThat(n).as("aday bildirimi app=%d", appId).hasSize(1);
            assertThat(n.get(0).getAggregateCount()).isEqualTo(1);
            assertThat(n.get(0).getMessage())
                    .isEqualTo("İlan süresi doldu: Gece resepsiyon. Başvurun sonuçlanmadan kapandı.");
        }
        assertThat(closedNotifications(candidateId(accepted))).isEmpty();

        // İkinci koşu: kapatılacak ilan yok, yeni bildirim yok
        assertThat(scheduler.closeEndedListings(LocalDateTime.now(TR))).isZero();
        Thread.sleep(300);   // olası asenkron yazımın tamamlanmasına fırsat ver
        for (Long appId : List.of(held, standby, reviewing, pending)) {
            List<Notification> n = closedNotifications(candidateId(appId));
            assertThat(n).hasSize(1);
            assertThat(n.get(0).getAggregateCount()).isEqualTo(1);
        }
    }

    @Test
    void manualClose_expiresOpenApplications_andNotifiesCandidate() throws Exception {
        LocalDate today = LocalDate.now(TR);
        String biz = register(business("ac-man-biz@app.com"));
        Long listing = createListing(biz, slot(today.plusDays(4), "09:00", "17:00", 1));
        Long slotId = firstSlotId(listing, biz);
        String c = register(candidate("ac-man-c@app.com"));
        Long app = apply(c, listing, slotId);

        mvc.perform(put("/api/listings/" + listing + "/status")
                        .param("status", "CLOSED")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        assertThat(applicationRepository.findById(app).orElseThrow().getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
        List<Notification> n = awaitClosedNotifications(candidateId(app), 1);
        assertThat(n).hasSize(1);
        assertThat(n.get(0).getMessage()).startsWith("İlan kapatıldı: ");
    }

    /* ─────────────────── Helpers ─────────────────── */

    private Long candidateId(Long appId) {
        return applicationRepository.findById(appId).orElseThrow().getCandidate().getId();
    }

    /**
     * Bildirim kaydı ileride commit sonrası/asenkron yazılabilir; beklenen sayıya
     * ulaşana kadar kısa süre yokla (en fazla 5 sn).
     */
    private List<Notification> awaitClosedNotifications(Long userId, int expected) throws InterruptedException {
        List<Notification> n = closedNotifications(userId);
        for (int i = 0; i < 50 && n.size() < expected; i++) {
            Thread.sleep(100);
            n = closedNotifications(userId);
        }
        return n;
    }

    private List<Notification> closedNotifications(Long userId) {
        return notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 50))
                .getContent().stream()
                .filter(x -> x.getType() == NotificationType.LISTING_CLOSED)
                .toList();
    }

    private org.springframework.test.web.servlet.ResultActions decide(String token, Long appId, ApplicationStatus d)
            throws Exception {
        ReviewRequest r = new ReviewRequest();
        r.setDecision(d);
        return mvc.perform(put("/api/business/applications/" + appId + "/decide")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(r)));
    }

    private Long apply(String token, Long listingId, Long slotId) throws Exception {
        ApplicationRequest a = new ApplicationRequest();
        a.setJobListingId(listingId);
        a.setSlotIds(List.of(slotId));
        String body = mvc.perform(post("/api/candidate/applications")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(a)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }

    private String register(RegisterRequest req) throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private Long createListing(String token, ShiftSlotCreate... slots) throws Exception {
        ListingRequest req = new ListingRequest();
        req.setPosition(Position.RECEPTION);
        req.setJobType(JobType.PART_TIME);
        req.setShift(Shift.NIGHT);
        req.setTitle("Gece resepsiyon");
        req.setDescription("Gece vardiyasi");
        req.setDressCode("Koyu takim");
        req.setPaymentPeriod(PaymentPeriod.SAME_DAY);
        req.setPaymentMethod(PaymentMethod.CASH);
        req.setShiftSlots(List.of(slots));
        String resp = mvc.perform(post("/api/listings")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("id").asLong();
    }

    private Long firstSlotId(Long listingId, String token) throws Exception {
        String resp = mvc.perform(get("/api/listings/" + listingId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("shiftSlots").get(0).get("id").asLong();
    }

    private ShiftSlotCreate slot(LocalDate date, String start, String end, int needed) {
        ShiftSlotCreate s = new ShiftSlotCreate();
        s.setDate(date);
        s.setStartTime(LocalTime.parse(start));
        s.setEndTime(LocalTime.parse(end));
        s.setSlotsNeeded(needed);
        return s;
    }

    private RegisterRequest candidate(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Aday Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 111 22 33");
        return r;
    }

    private RegisterRequest business(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Biz Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.BUSINESS_OWNER);
        r.setPhone("0555 222 33 44");
        r.setBusinessName("Gece Otel");
        r.setBusinessType(BusinessType.HOTEL);
        r.setDistrict("Beyoglu");
        r.setBusinessPhone("0212 555 12 34");
        return r;
    }
}
