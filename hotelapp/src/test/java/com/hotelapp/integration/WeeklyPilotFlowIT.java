package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.enums.*;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.service.*;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Seven business days accelerated with service-local clocks, never the machine clock.
 * Real HTTP controller/security/service/JPA boundaries and an isolated H2 database;
 * deliberately no outer test transaction, mocked repositories, or pre-inserted work sessions.
 * QR is entry-only; exit is the candidate's GPS action. Wage/IBAN discussions are test
 * messages, not a bank transfer or an implemented payroll/payment confirmation ledger.
 * Does not simulate cameras, physical presence, browser rendering or JWT expiry over a week.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:weekly_pilot;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class WeeklyPilotFlowIT {
    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final String GPS = "{\"lat\":41.0,\"lng\":29.0}";
    private static final BigDecimal HOURLY_RATE = new BigDecimal("125.00");

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private WorkSessionRepository sessions;
    @Autowired private ApplicationService applications;
    @Autowired private JobListingService listings;
    @Autowired private CheckInService checkIn;
    @Autowired private WorkSessionService work;
    @Autowired private EarningsService earnings;
    @Autowired private ApplicationMapper mapper;
    @Autowired private RosterService roster;
    @Autowired private ListingAutoCloseScheduler autoClose;
    @Autowired private ExpiredApplicationScheduler expiry;
    private final Map<Object, Object> originalClocks = new IdentityHashMap<>();

    @AfterEach
    void restoreBusinessClocks() {
        originalClocks.forEach((bean, clock) -> ReflectionTestUtils.setField(bean, "clock", clock));
    }

    @Test
    void sevenShifts_havePersistentChatUniqueQrEntriesGpsExitsAndCompletedHistory() throws Exception {
        LocalDate firstDay = LocalDate.now(TR).plusDays(10);
        at(firstDay.minusDays(1).atTime(10, 0));
        Account owner = register("weekly-owner@example.test", Role.BUSINESS_OWNER);
        Account foreignOwner = register("weekly-foreign-owner@example.test", Role.BUSINESS_OWNER);
        Account candidate = register("weekly-candidate@example.test", Role.CANDIDATE);

        mvc.perform(put("/api/business/profile").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Haftalık Pilot Test Kafe\",\"type\":\"CAFE\","
                                + "\"district\":\"Beyoglu\",\"latitude\":41.0,\"longitude\":29.0}"))
                .andExpect(status().isOk());

        ListingRequest listing = new ListingRequest();
        listing.setPosition(Position.WAITER);
        listing.setJobType(JobType.PART_TIME);
        listing.setShift(Shift.MORNING);
        listing.setTitle("Yedi vardiya pilot testi");
        listing.setDescription("Yalnız izole test verisi: altı gündüz, bir gece vardiyası.");
        listing.setDressCode("Siyah tişört");
        listing.setSalaryMin(HOURLY_RATE);
        listing.setSalaryMax(HOURLY_RATE);
        listing.setSalaryType(SalaryType.HOURLY);
        listing.setPaymentPeriod(PaymentPeriod.WEEKLY);
        listing.setPaymentMethod(PaymentMethod.BANK_TRANSFER);
        listing.setPaymentNote("Hafta sonunda havale; bu test gerçek para transferi yapmaz.");
        List<ShiftSlotCreate> shifts = new ArrayList<>();
        for (int day = 0; day < 7; day++) {
            ShiftSlotCreate slot = new ShiftSlotCreate();
            slot.setDate(firstDay.plusDays(day));
            slot.setStartTime(LocalTime.of(day == 6 ? 22 : 9, 0));
            slot.setEndTime(LocalTime.of(day == 6 ? 6 : 17, 0));
            slot.setSlotsNeeded(1);
            shifts.add(slot);
        }
        listing.setShiftSlots(shifts);
        JsonNode published = body(mvc.perform(post("/api/listings").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(listing)))
                .andExpect(status().is2xxSuccessful()));
        long listingId = published.path("id").asLong();
        assertThat(listingId).isPositive();
        assertThat(published.path("shiftSlots").size()).isEqualTo(7);
        List<Long> slotIds = new ArrayList<>();
        published.path("shiftSlots").forEach(slot -> slotIds.add(slot.path("id").asLong()));

        ApplicationRequest request = new ApplicationRequest();
        request.setJobListingId(listingId);
        request.setSlotIds(slotIds);
        long applicationId = body(mvc.perform(post("/api/candidate/applications")
                        .header("Authorization", candidate.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request))).andExpect(status().isCreated()))
                .path("id").asLong();
        assertThat(applicationId).isPositive();

        JsonNode conversation = body(mvc.perform(post("/api/messages/conversations")
                        .header("Authorization", candidate.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("otherPartyId", owner.id(), "applicationId", applicationId))))
                .andExpect(status().isCreated()));
        long conversationId = conversation.path("id").asLong();
        List<String> messages = new ArrayList<>();
        say(candidate, conversationId, "Merhaba, yedi vardiya için saatlik ücret 125 TL mi?", messages);
        say(owner, conversationId, "Evet, 56 saat için beklenen brüt tutar 7000 TL. Haftalık havale. Test IBAN paylaşır mısın?", messages);
        say(candidate, conversationId, "YALNIZ TEST: TR00 0000 0000 0000 0000 0000 00 — gerçek banka hesabı değildir.", messages);
        say(owner, conversationId, "Anlaştık. Bu konuşma ödeme taahhüdü testi; gerçek havale yapılmayacak.", messages);

        ReviewRequest accept = new ReviewRequest();
        accept.setDecision(ApplicationStatus.ACCEPTED);
        mvc.perform(put("/api/business/applications/" + applicationId + "/decide")
                        .header("Authorization", owner.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(accept)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.workCompleted").value(false));
        mvc.perform(get("/api/candidate/passes").header("Authorization", candidate.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertEarnings(candidate, applicationId, 0);
        mvc.perform(get("/api/messages/conversations/" + conversationId + "/messages")
                        .header("Authorization", foreignOwner.bearer()))
                .andExpect(status().isForbidden());

        Set<Long> enteredSlots = new HashSet<>();
        String previousCard = null;
        for (int day = 0; day < 7; day++) {
            LocalDate date = firstDay.plusDays(day);
            LocalDateTime start = date.atTime(day == 6 ? 22 : 9, 0);
            at(start);
            say(candidate, conversationId, "Gün " + (day + 1) + ": vardiyaya geldim, giriş kartım hazır.", messages);
            JsonNode passes = body(mvc.perform(get("/api/candidate/passes")
                    .header("Authorization", candidate.bearer())).andExpect(status().isOk()));
            assertThat(passes.size()).isEqualTo(1);
            JsonNode pass = passes.get(0);
            assertThat(pass.path("applicationId").asLong()).isEqualTo(applicationId);
            assertThat(pass.path("shiftDate").asText()).isEqualTo(date.toString());
            long slotId = pass.path("shiftSlotId").asLong();
            assertThat(enteredSlots.add(slotId)).isTrue();
            String url = pass.path("passUrl").asText();
            String card = url.substring(url.lastIndexOf('/') + 1);
            if (previousCard != null) scan(owner, previousCard).andExpect(status().isUnprocessableEntity());
            scan(owner, card + "invalid").andExpect(status().isUnprocessableEntity());
            scan(foreignOwner, card).andExpect(status().isForbidden());
            assertThat(sessions.findByApplicationIdOrderByClockInAtDesc(applicationId)).hasSize(day);

            scan(owner, card).andExpect(status().isOk())
                    .andExpect(jsonPath("$.alreadyUsed").value(false))
                    .andExpect(jsonPath("$.fullName").value("Haftalık Test Adayı"));
            at(start.plusMinutes(5));
            scan(owner, card).andExpect(status().isOk()).andExpect(jsonPath("$.alreadyUsed").value(true));
            assertThat(sessions.findByApplicationIdOrderByClockInAtDesc(applicationId)).hasSize(day + 1);
            mvc.perform(get("/api/candidate/work-sessions/" + applicationId + "/active")
                            .header("Authorization", candidate.bearer()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.clockOutAt").doesNotExist());
            attendance(owner, listingId, date).andExpect(jsonPath("$.arrived").value(1))
                    .andExpect(jsonPath("$.rows[0].status").value("İşte"));
            mvc.perform(post("/api/candidate/work-sessions/" + applicationId + "/clock-in")
                            .header("Authorization", candidate.bearer()).contentType(MediaType.APPLICATION_JSON).content(GPS))
                    .andExpect(status().isUnprocessableEntity());
            say(owner, conversationId, "Gün " + (day + 1) + ": girişini yoklamada görüyorum.", messages);

            // Night shift remains open into tomorrow; every shift lasts exactly eight hours.
            if (day == 6) {
                at(start.plusHours(7));
                mvc.perform(get("/api/candidate/passes").header("Authorization", candidate.bearer()))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                        .andExpect(jsonPath("$[0].shiftDate").value(date.toString()));
            }
            at(start.plusHours(8));
            mvc.perform(post("/api/candidate/work-sessions/" + applicationId + "/clock-out")
                            .header("Authorization", candidate.bearer()).contentType(MediaType.APPLICATION_JSON).content(GPS))
                    .andExpect(status().isUnprocessableEntity());
            JsonNode exits = body(mvc.perform(get("/api/candidate/exit-passes")
                    .header("Authorization", candidate.bearer())).andExpect(status().isOk()));
            assertThat(exits.size()).isEqualTo(1);
            String exitUrl = exits.get(0).path("passUrl").asText();
            String exitCard = exitUrl.substring(exitUrl.lastIndexOf('/') + 1);
            scanExit(candidate, exitCard).andExpect(status().isForbidden());
            scanExit(foreignOwner, exitCard).andExpect(status().isForbidden());
            scanExit(owner, card).andExpect(status().isUnprocessableEntity());
            scan(owner, exitCard).andExpect(status().isUnprocessableEntity());
            scanExit(owner, exitCard).andExpect(status().isOk()).andExpect(jsonPath("$.alreadyUsed").value(false));
            scanExit(owner, exitCard).andExpect(status().isOk()).andExpect(jsonPath("$.alreadyUsed").value(true));
            mvc.perform(get("/api/candidate/exit-passes").header("Authorization", candidate.bearer()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
            mvc.perform(get("/api/candidate/work-sessions/" + applicationId + "/active")
                            .header("Authorization", candidate.bearer()))
                    .andExpect(status().isNoContent());
            scan(owner, card).andExpect(status().isUnprocessableEntity());
            attendance(owner, listingId, date).andExpect(jsonPath("$.expected").value(1))
                    .andExpect(jsonPath("$.arrived").value(1))
                    .andExpect(jsonPath("$.rows[0].status").value("Tamamladı"));
            assertEarnings(candidate, applicationId, day + 1);
            say(candidate, conversationId, "Gün " + (day + 1) + ": 8 saatlik vardiyamı bitirdim.", messages);
            previousCard = card;
        }

        assertThat(enteredSlots).containsExactlyInAnyOrderElementsOf(slotIds);
        var persisted = sessions.findByApplicationIdOrderByClockInAtDesc(applicationId);
        assertThat(persisted).hasSize(7).allSatisfy(session -> {
            assertThat(session.getClockOutAt()).isNotNull();
            assertThat(Duration.between(session.getClockInAt(), session.getClockOutAt())).isEqualTo(Duration.ofHours(8));
            assertThat(session.getClockOutDistanceMeters()).isNull();
        });
        assertThat(sessions.findByApplicationCandidateIdAndClockOutAtIsNull(candidate.id())).isEmpty();
        JsonNode history = body(mvc.perform(get("/api/candidate/work-sessions/" + applicationId)
                .header("Authorization", candidate.bearer())).andExpect(status().isOk()));
        assertThat(history.size()).isEqualTo(7);
        long minutes = 0;
        for (JsonNode session : history) minutes += session.path("durationMinutes").asLong();
        assertThat(minutes).isEqualTo(3360);
        JsonNode finalListing = body(mvc.perform(get("/api/listings/" + listingId)
                .header("Authorization", candidate.bearer())).andExpect(status().isOk()));
        assertThat(finalListing.path("salaryType").asText()).isEqualTo("HOURLY");
        assertThat(finalListing.path("paymentMethod").asText()).isEqualTo("BANK_TRANSFER");
        BigDecimal storedRate = finalListing.path("salaryMin").decimalValue();
        assertThat(storedRate).isEqualByComparingTo(HOURLY_RATE);
        // Derived contractual gross, not a payment-ledger balance or transferred money.
        assertThat(storedRate.multiply(BigDecimal.valueOf(minutes)).divide(BigDecimal.valueOf(60)))
                .isEqualByComparingTo("7000.00");
        mvc.perform(get("/api/candidate/applications").header("Authorization", candidate.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(applicationId))
                .andExpect(jsonPath("$.content[0].workCompleted").value(true));
        assertThat(autoClose.closeEndedListings(firstDay.plusDays(7).atTime(6, 1))).isEqualTo(1);
        mvc.perform(get("/api/listings/" + listingId).header("Authorization", owner.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CLOSED"));
        say(owner, conversationId, "Yedi vardiya ve toplam 56 saat tamamlandı; beklenen brüt ücret 7000 TL. Gerçek ödeme yapılmadı.", messages);
        assertMessages(candidate, conversationId, messages);
        assertMessages(owner, conversationId, messages);
    }

    private void at(LocalDateTime time) {
        Clock clock = Clock.fixed(time.atZone(TR).toInstant(), TR);
        for (Object bean : List.of(applications, listings, checkIn, work, earnings, mapper, roster, autoClose, expiry)) {
            originalClocks.computeIfAbsent(bean, b -> ReflectionTestUtils.getField(b, "clock"));
            ReflectionTestUtils.setField(bean, "clock", clock);
        }
    }

    private ResultActions scan(Account owner, String card) throws Exception {
        return mvc.perform(post("/api/business/passes/" + card + "/scan").header("Authorization", owner.bearer()));
    }

    private ResultActions scanExit(Account owner, String card) throws Exception {
        return mvc.perform(post("/api/business/passes/" + card + "/exit").header("Authorization", owner.bearer()));
    }

    /** Verify the application's actual earnings response, not only test-side arithmetic. */
    private void assertEarnings(Account candidate, long applicationId, int completedShifts) throws Exception {
        JsonNode response = body(mvc.perform(get("/api/candidate/earnings")
                        .header("Authorization", candidate.bearer()))
                .andExpect(status().isOk()));
        assertThat(response.path("shiftCount").asInt()).isEqualTo(completedShifts);
        assertThat(response.path("totalHours").asDouble()).isEqualTo(completedShifts * 8.0);
        assertThat(response.path("totalGross").decimalValue())
                .isEqualByComparingTo(BigDecimal.valueOf(completedShifts * 1000L));
        assertThat(response.path("unpricedShiftCount").asInt()).isZero();
        JsonNode entries = response.path("entries");
        assertThat(entries.isArray()).isTrue();
        assertThat(entries.size()).isEqualTo(completedShifts);
        for (JsonNode entry : entries) {
            assertThat(entry.path("applicationId").asLong()).isEqualTo(applicationId);
            assertThat(entry.path("hoursSource").asText()).isEqualTo("CLOCKED");
            assertThat(entry.path("hours").asDouble()).isEqualTo(8.0);
            assertThat(entry.path("gross").decimalValue()).isEqualByComparingTo("1000.00");
        }
    }

    private ResultActions attendance(Account owner, long listingId, LocalDate day) throws Exception {
        return mvc.perform(get("/api/business/listings/" + listingId + "/attendance")
                        .param("date", day.toString()).header("Authorization", owner.bearer()))
                .andExpect(status().isOk());
    }

    private void say(Account sender, long conversationId, String content, List<String> expected) throws Exception {
        mvc.perform(post("/api/messages/conversations/" + conversationId + "/messages")
                        .header("Authorization", sender.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("content", content))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.content").value(content))
                .andExpect(jsonPath("$.senderId").value(sender.id()));
        expected.add(content);
    }

    private void assertMessages(Account reader, long conversationId, List<String> expected) throws Exception {
        JsonNode response = body(mvc.perform(get("/api/messages/conversations/" + conversationId + "/messages")
                        .param("size", "100").header("Authorization", reader.bearer()))
                .andExpect(status().isOk()));
        List<String> contents = new ArrayList<>();
        response.path("content").forEach(message -> contents.add(message.path("content").asText()));
        assertThat(contents).containsAll(expected);
        for (String text : expected) assertThat(Collections.frequency(contents, text)).isEqualTo(1);
    }

    private Account register(String email, Role role) throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setTermsAccepted(true);
        request.setPrivacyNoticeVersion("2026-10-17");
        request.setFullName(role == Role.CANDIDATE ? "Haftalık Test Adayı" : "Haftalık Test İşletmesi");
        request.setEmail(email);
        request.setPassword("WeeklyTest1234!");
        request.setRole(role);
        request.setPhone("0555 111 22 33");
        if (role == Role.BUSINESS_OWNER) {
            request.setBusinessName("Haftalık Pilot Test Kafe");
            request.setBusinessType(BusinessType.CAFE);
            request.setDistrict("Beyoglu");
            request.setBusinessPhone("0212 555 12 34");
        }
        JsonNode response = body(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request))).andExpect(status().isOk()));
        assertThat(response.path("token").asText()).isNotBlank();
        return new Account(response.path("userId").asLong(), response.path("token").asText());
    }

    private JsonNode body(ResultActions action) throws Exception {
        return json.readTree(action.andReturn().getResponse().getContentAsString());
    }

    private record Account(long id, String token) {
        String bearer() { return "Bearer " + token; }
    }
}
