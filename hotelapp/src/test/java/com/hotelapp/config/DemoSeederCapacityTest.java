package com.hotelapp.config;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ApplicationNoShowSlot;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vitrin/demo seed'i: ACCEPTED basvurular koltuk tutar. Her slotta slotsFilled,
 * o slottaki ACCEPTED (gelmedi isaretsiz) basvuru sayisina esit ve slotsNeeded'i asmaz.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class DemoSeederCapacityTest {

    @Autowired UserRepository userRepository;
    @Autowired BusinessRepository businessRepository;
    @Autowired JobListingRepository jobListingRepository;
    @Autowired ShiftSlotRepository shiftSlotRepository;
    @Autowired ApplicationRepository applicationRepository;
    @Autowired ConversationRepository conversationRepository;
    @Autowired MessageRepository messageRepository;
    @Autowired TestEntityManager em;

    private DemoSeeder seeder() {
        return new DemoSeeder(userRepository, businessRepository, jobListingRepository,
                shiftSlotRepository, applicationRepository, conversationRepository,
                messageRepository, new BCryptPasswordEncoder(4));
    }

    @Test
    @DisplayName("Seed sonrasi her slotta slotsFilled = ACCEPTED basvuru sayisi ve <= slotsNeeded")
    void seededSeatCountersMatchAcceptedApplications() {
        seeder().run();
        em.flush();
        em.clear();

        List<Application> apps = applicationRepository.findAll();
        List<ShiftSlot> slots = shiftSlotRepository.findAll();
        assertThat(slots).isNotEmpty();
        assertThat(apps).anyMatch(a -> a.getStatus() == ApplicationStatus.ACCEPTED);

        for (ShiftSlot slot : slots) {
            long accepted = apps.stream()
                    .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                    .filter(a -> a.getRequestedSlots().stream().anyMatch(s -> Objects.equals(s.getId(), slot.getId())))
                    .filter(a -> a.getNoShowSlots().stream().map(ApplicationNoShowSlot::getShiftSlot)
                            .noneMatch(s -> s != null && Objects.equals(s.getId(), slot.getId())))
                    .count();
            assertThat(slot.getSlotsFilled())
                    .as("slot %d dolu sayaci", slot.getId())
                    .isEqualTo((int) accepted)
                    .isLessThanOrEqualTo(slot.getSlotsNeeded());
        }
        // ACCEPTED basvuru tam bir slotta koltuk tutar
        assertThat(apps).filteredOn(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .allSatisfy(a -> assertThat(a.getRequestedSlots()).hasSize(1));
    }
}
