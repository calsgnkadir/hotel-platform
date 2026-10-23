package com.hotelapp.integration;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.security.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A04 bounded regression for same-role candidate ownership on the three
 * work-session read routes. All records are synthetic and the test transaction
 * rolls back; it does not exercise a deployed or production configuration.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WorkSessionReadOwnershipHttpTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired BusinessRepository businesses;
    @Autowired JobListingRepository listings;
    @Autowired ApplicationRepository applications;
    @Autowired WorkSessionRepository workSessions;

    @Test
    void sameRoleCandidatesSeeOnlyTheirOwnApplicationSessions() throws Exception {
        Fixture fixture = fixture();

        // Single active-session route: owner receives the row; a second
        // candidate with the same role receives the documented no-content shape.
        mvc.perform(get(active(fixture.applicationA().getId()))
                        .with(user(new UserPrincipal(fixture.candidateA()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(fixture.openA().getId().intValue()))
                .andExpect(jsonPath("$.applicationId").value(fixture.applicationA().getId().intValue()));

        mvc.perform(get(active(fixture.applicationA().getId()))
                        .with(user(new UserPrincipal(fixture.candidateB()))))
                .andExpect(status().isNoContent());

        // Batch route omits an application the principal does not own while
        // retaining the positive-control session belonging to that principal.
        mvc.perform(get("/api/candidate/work-sessions/active-batch")
                        .param("ids", fixture.applicationA().getId().toString(),
                                fixture.applicationB().getId().toString())
                        .with(user(new UserPrincipal(fixture.candidateA()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + fixture.applicationA().getId() + "'].id")
                        .value(fixture.openA().getId().intValue()))
                .andExpect(jsonPath("$['" + fixture.applicationB().getId() + "']").doesNotExist());

        mvc.perform(get("/api/candidate/work-sessions/active-batch")
                        .param("ids", fixture.applicationA().getId().toString(),
                                fixture.applicationB().getId().toString())
                        .with(user(new UserPrincipal(fixture.candidateB()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + fixture.applicationA().getId() + "']").doesNotExist())
                .andExpect(jsonPath("$['" + fixture.applicationB().getId() + "'].id")
                        .value(fixture.openB().getId().intValue()));

        // History route filters every row by the authenticated candidate, while
        // preserving each candidate's own positive-control history.
        mvc.perform(get(history(fixture.applicationA().getId()))
                        .with(user(new UserPrincipal(fixture.candidateA()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].id").value(containsInAnyOrder(
                        fixture.openA().getId().intValue(), fixture.closedA().getId().intValue())));

        mvc.perform(get(history(fixture.applicationA().getId()))
                        .with(user(new UserPrincipal(fixture.candidateB()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mvc.perform(get(history(fixture.applicationB().getId()))
                        .with(user(new UserPrincipal(fixture.candidateB()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(fixture.openB().getId().intValue()));

        mvc.perform(get(history(fixture.applicationB().getId()))
                        .with(user(new UserPrincipal(fixture.candidateA()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    private Fixture fixture() {
        String tag = UUID.randomUUID().toString();
        User candidateA = candidate("a-" + tag);
        User candidateB = candidate("b-" + tag);
        User owner = users.saveAndFlush(User.builder()
                .email("owner-" + tag + "@test.local")
                .password("synthetic-test-only")
                .fullName("Synthetic Owner")
                .role(Role.BUSINESS_OWNER)
                .build());
        Business business = businesses.saveAndFlush(Business.builder()
                .name("Synthetic Hotel")
                .type(BusinessType.HOTEL)
                .owner(owner)
                .build());
        JobListing listing = listings.saveAndFlush(JobListing.builder()
                .business(business)
                .position(Position.WAITER)
                .jobType(JobType.PART_TIME)
                .title("Synthetic shift")
                .description("Test fixture only")
                .status(ListingStatus.ACTIVE)
                .build());
        Application applicationA = application(candidateA, listing);
        Application applicationB = application(candidateB, listing);

        LocalDateTime start = LocalDateTime.of(2026, 10, 23, 9, 0);
        WorkSession openA = workSessions.saveAndFlush(WorkSession.builder()
                .application(applicationA)
                .clockInAt(start)
                .build());
        WorkSession closedA = workSessions.saveAndFlush(WorkSession.builder()
                .application(applicationA)
                .clockInAt(start.minusDays(1))
                .clockOutAt(start.minusDays(1).plusHours(8))
                .build());
        WorkSession openB = workSessions.saveAndFlush(WorkSession.builder()
                .application(applicationB)
                .clockInAt(start.plusHours(1))
                .build());

        return new Fixture(candidateA, candidateB, applicationA, applicationB,
                openA, closedA, openB);
    }

    private User candidate(String suffix) {
        return users.saveAndFlush(User.builder()
                .email("candidate-" + suffix + "@test.local")
                .password("synthetic-test-only")
                .fullName("Synthetic Candidate")
                .role(Role.CANDIDATE)
                .build());
    }

    private Application application(User candidate, JobListing listing) {
        return applications.saveAndFlush(Application.builder()
                .candidate(candidate)
                .jobListing(listing)
                .status(ApplicationStatus.ACCEPTED)
                .deadline(LocalDateTime.of(2026, 10, 30, 12, 0))
                .build());
    }

    private String active(Long applicationId) {
        return "/api/candidate/work-sessions/" + applicationId + "/active";
    }

    private String history(Long applicationId) {
        return "/api/candidate/work-sessions/" + applicationId;
    }

    private record Fixture(User candidateA, User candidateB,
                           Application applicationA, Application applicationB,
                           WorkSession openA, WorkSession closedA, WorkSession openB) { }
}
