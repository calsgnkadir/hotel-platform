package com.hotelapp.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.enums.*;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 2. adım uçtan uca: gece vardiyası ilanı, slot kapasitesi (dolu slotta kabul 422 ve
 * tam geri alma), süresi dolan HOLD'un kalıcı EXPIRED olması, no-show slotId parametresi.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShiftCapacityFlowIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private ShiftSlotRepository shiftSlotRepository;

    @Test
    void overnight_listing_capacity_hold_expiry_and_no_show_rules() throws Exception {
        String biz = register(business("cap-biz@app.com"));
        // Gece vardiyasi 22:00 -> ertesi gun 06:00, 1 kisilik
        Long listingId = createListing(biz, slot(LocalDate.now().plusDays(4), "22:00", "06:00", 1));
        Long slotId = firstSlotId(listingId, biz);

        String c1 = register(candidate("cap-a1@app.com"));
        String c2 = register(candidate("cap-a2@app.com"));
        String c3 = register(candidate("cap-a3@app.com"));
        Long app1 = apply(c1, listingId, slotId);
        Long app2 = apply(c2, listingId, slotId);
        Long app3 = apply(c3, listingId, slotId);

        // 1) Ilk kabul koltugu alir
        decide(biz, app1, ApplicationStatus.ACCEPTED)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        // 2) Ikinci kabul: 422 "Bu vardiya doldu" ve basvuru durumu geri alinir
        decide(biz, app2, ApplicationStatus.ACCEPTED)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message", containsString("Bu vardiya doldu")));
        assertThat(applicationRepository.findById(app2).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.PENDING);
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isEqualTo(1);

        // 3) HOLD suresi dolmus: aday yanitinda 422, EXPIRED kalici (rollback yok)
        mvc.perform(put("/api/business/applications/" + app3 + "/hold")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk());
        Application held = applicationRepository.findById(app3).orElseThrow();
        held.setHoldDeadline(LocalDateTime.now().minusMinutes(1));
        applicationRepository.save(held);
        mvc.perform(put("/api/candidate/applications/" + app3 + "/respond-hold")
                        .param("accept", "true")
                        .header("Authorization", "Bearer " + c3))
                .andExpect(status().isUnprocessableEntity());
        assertThat(applicationRepository.findById(app3).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.EXPIRED);
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isEqualTo(1);

        // 4) No-show: vardiya henuz baslamadi -> 422 (slotId parametresi kabul edilir)
        mvc.perform(put("/api/business/applications/" + app1 + "/no-show")
                        .param("slotId", String.valueOf(slotId))
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message", containsString("30 dakika sonra")));
        assertThat(applicationRepository.findById(app1).orElseThrow().isNoShow()).isFalse();
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isEqualTo(1);
    }

    /**
     * Son koltuga iki gercek is parcacigiyla ayni anda kabul. Kosullu atomik UPDATE
     * (slotsFilled < slotsNeeded) yalniz birine 1 satir dondurur.
     *
     * <p>Not: H2'de (test profili) ikinci UPDATE satir kilidinde bekler ya da kilit
     * zaman asimina duser; her iki durumda da kazanan tektir ve sayac 1 kalir. Yarisin
     * gercek InnoDB davranisi icin bu test MySQL'e karsi kosuldugunda anlamlidir; burada
     * kaybedenin durum kodu (422/409/500) degil, "tek kazanan + sayac 1" dogrulanir.
     */
    @Test
    void concurrentAccepts_onlyOneGetsLastSeat() throws Exception {
        String biz = register(business("cap-race-biz@app.com"));
        Long listingId = createListing(biz, slot(LocalDate.now().plusDays(5), "09:00", "17:00", 1));
        Long slotId = firstSlotId(listingId, biz);
        Long appA = apply(register(candidate("cap-race-a@app.com")), listingId, slotId);
        Long appB = apply(register(candidate("cap-race-b@app.com")), listingId, slotId);

        java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<Integer> a = () -> { go.await(); return decide(biz, appA, ApplicationStatus.ACCEPTED).andReturn().getResponse().getStatus(); };
            java.util.concurrent.Callable<Integer> b = () -> { go.await(); return decide(biz, appB, ApplicationStatus.ACCEPTED).andReturn().getResponse().getStatus(); };
            var fa = pool.submit(a);
            var fb = pool.submit(b);
            go.countDown();
            List<Integer> codes = List.of(fa.get(30, java.util.concurrent.TimeUnit.SECONDS),
                    fb.get(30, java.util.concurrent.TimeUnit.SECONDS));

            assertThat(codes).containsOnlyOnce(200);
        } finally {
            pool.shutdownNow();
        }
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isEqualTo(1);
        long accepted = java.util.stream.Stream.of(appA, appB)
                .map(id -> applicationRepository.findById(id).orElseThrow().getStatus())
                .filter(st -> st == ApplicationStatus.ACCEPTED).count();
        assertThat(accepted).isEqualTo(1);
    }

    /**
     * V25 uctan uca: QR/elle giris kullanmayan isletme. 2 vardiyali kabul; ilk vardiya
     * gecmiste (calisildi, giris kaydi yok), ikincisi su an suruyor. slotId'siz "gelmedi"
     * yalniz suren vardiyayi isaretler; calisilmis vardiya basvuruda kalir.
     */
    @Test
    void noShowWithoutSlotId_marksOnlyCurrentShift_andKeepsWorkedShift() throws Exception {
        String biz = register(business("cap-ns-biz@app.com"));
        String cand = register(candidate("cap-ns-a@app.com"));
        Long listingId = createListing(biz,
                slot(LocalDate.now().plusDays(6), "08:00", "16:00", 2),
                slot(LocalDate.now().plusDays(7), "08:00", "16:00", 2));
        String resp = mvc.perform(get("/api/listings/" + listingId).header("Authorization", "Bearer " + biz))
                .andReturn().getResponse().getContentAsString();
        var slotsJson = json.readTree(resp).get("shiftSlots");
        Long s1 = slotsJson.get(0).get("id").asLong();
        Long s2 = slotsJson.get(1).get("id").asLong();

        ApplicationRequest a = new ApplicationRequest();
        a.setJobListingId(listingId);
        a.setSlotIds(List.of(s1, s2));
        String body = mvc.perform(post("/api/candidate/applications")
                        .header("Authorization", "Bearer " + cand)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(a)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Long appId = json.readTree(body).get("id").asLong();
        decide(biz, appId, ApplicationStatus.ACCEPTED).andExpect(status().isOk());

        // Ileri tarihli kabul henuz "tamamlanan is" degildir (O2): hicbir vardiya bitmedi.
        mvc.perform(get("/api/listings/" + listingId).header("Authorization", "Bearer " + cand))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessWorkerCount").value(0));

        // Zamani kaydir: s1 iki gun once calisildi, s2 iki saat once basladi (TR saati).
        LocalDateTime nowTr = LocalDateTime.now(java.time.ZoneId.of("Europe/Istanbul")).withSecond(0).withNano(0);
        moveSlot(s1, nowTr.minusDays(2).minusHours(2));
        Long current = s2;
        moveSlot(current, nowTr.minusHours(2));

        // Dogrudan kabul (incelemeye alinmadan) da, bir vardiyasi bitince, ilan detayindaki
        // "bu isletmede tamamlanan is" sayisina girer.
        mvc.perform(get("/api/listings/" + listingId).header("Authorization", "Bearer " + cand))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessWorkerCount").value(1));

        mvc.perform(put("/api/business/applications/" + appId + "/no-show")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.application.noShow").value(true))
                .andExpect(jsonPath("$.application.noShowSlotIds.length()").value(1))
                .andExpect(jsonPath("$.application.noShowSlotIds[0]").value(current))
                .andExpect(jsonPath("$.application.requestedSlots.length()").value(2))
                .andExpect(jsonPath("$.candidateStrikesRemaining").value(2));
        assertThat(shiftSlotRepository.findById(s1).orElseThrow().getSlotsFilled()).isEqualTo(1);
        assertThat(shiftSlotRepository.findById(current).orElseThrow().getSlotsFilled()).isZero();

        // Ayni vardiya ikinci kez: 422, koltuk ikinci kez bosalmaz
        mvc.perform(put("/api/business/applications/" + appId + "/no-show")
                        .param("slotId", String.valueOf(current))
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message", containsString("zaten gelmedi")));
        // slotId'siz tekrar: eski (calisilmis) vardiyaya dusmez
        mvc.perform(put("/api/business/applications/" + appId + "/no-show")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message", containsString("zaten gelmedi")));
        assertThat(shiftSlotRepository.findById(s1).orElseThrow().getSlotsFilled()).isEqualTo(1);
        assertThat(shiftSlotRepository.findById(current).orElseThrow().getSlotsFilled()).isZero();
    }

    private void moveSlot(Long slotId, LocalDateTime start) {
        var s = shiftSlotRepository.findById(slotId).orElseThrow();
        s.setDate(start.toLocalDate());
        s.setStartTime(start.toLocalTime());
        s.setEndTime(start.toLocalTime().plusHours(4));
        shiftSlotRepository.save(s);
    }

    /**
     * Hesap kapanisi uctan uca (gercek JPA): kabul edilmis adayin hesabi silinince
     * gelecek vardiyanin koltugu bosalir ve yedek adaya teklif gider (atomik sayac
     * sonrasi slot durumu tazelenir). Isletme hesabi silinince ilan kapanir, acik
     * basvuru EXPIRED olur.
     */
    @Test
    void accountDeletion_releasesSeat_offersStandby_andClosesBusinessListings() throws Exception {
        String biz = register(business("del-biz@app.com"));
        Long listingId = createListing(biz, slot(LocalDate.now().plusDays(6), "09:00", "17:00", 1));
        Long slotId = firstSlotId(listingId, biz);
        String c1 = register(candidate("del-a1@app.com"));
        String c2 = register(candidate("del-a2@app.com"));
        String c3 = register(candidate("del-a3@app.com"));
        Long app1 = apply(c1, listingId, slotId);
        Long app2 = apply(c2, listingId, slotId);
        Long app3 = apply(c3, listingId, slotId);
        decide(biz, app1, ApplicationStatus.ACCEPTED).andExpect(status().isOk());
        mvc.perform(put("/api/business/applications/" + app2 + "/standby")
                        .header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk());
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isEqualTo(1);

        // Kabul edilmis aday hesabini kapatir
        mvc.perform(delete("/api/me").header("Authorization", "Bearer " + c1))
                .andExpect(status().isOk());

        assertThat(applicationRepository.findById(app1).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.WITHDRAWN);
        assertThat(shiftSlotRepository.findById(slotId).orElseThrow().getSlotsFilled()).isZero();
        Application standby = applicationRepository.findById(app2).orElseThrow();
        assertThat(standby.getStatus()).isEqualTo(ApplicationStatus.STANDBY);
        assertThat(standby.getStandbyOfferedAt()).isNotNull();
        assertThat(standby.getStandbyReplacesApplicationId()).isEqualTo(app1);

        // Isletme hesabini kapatir: ilan kapanir, acik basvurular EXPIRED
        mvc.perform(delete("/api/me").header("Authorization", "Bearer " + biz))
                .andExpect(status().isOk());
        assertThat(applicationRepository.findById(app3).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.EXPIRED);
        assertThat(applicationRepository.findById(app2).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.EXPIRED);
        mvc.perform(get("/api/listings/" + listingId).header("Authorization", "Bearer " + c3))
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void slot_with_equal_start_and_end_is_rejected() throws Exception {
        String biz = register(business("cap-biz2@app.com"));
        ListingRequest req = listingRequest(slot(LocalDate.now().plusDays(4), "08:00", "08:00", 1));
        mvc.perform(post("/api/listings")
                        .header("Authorization", "Bearer " + biz)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message", containsString("aynı olamaz")));
    }

    /* ─────────────────── Helpers ─────────────────── */

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

    private ListingRequest listingRequest(ShiftSlotCreate... slots) {
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
        return req;
    }

    private Long createListing(String token, ShiftSlotCreate... slots) throws Exception {
        String resp = mvc.perform(post("/api/listings")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(listingRequest(slots))))
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
