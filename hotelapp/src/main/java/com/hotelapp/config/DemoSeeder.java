package com.hotelapp.config;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import com.hotelapp.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * #79: Demo profili için zengin örnek veri.
 *
 * Aktivasyon: SPRING_PROFILES_ACTIVE=dev,demo (veya prod,demo - dikkatli ol!)
 *
 * Idempotent: "demo-aday1@test.com" varsa hiç dokunmaz. Yoksa baştan kurar.
 * Şifreler: Demo1234! (hepsi)
 *
 * Veri seti:
 *   - 6 işletme (otel + restoran + kafe karışık)
 *   - 10 aday (farklı yaş, ilçe, pozisyon tercihi)
 *   - ~15 aktif ilan
 *   - ~60 başvuru (PENDING/REVIEWING/ACCEPTED/REJECTED gerçekçi dağılım)
 *   - ~15 review (4-5 yıldız ağırlıklı)
 *   - 4 sohbet + birkaç mesaj
 */
@Component
@Profile("demo")
@RequiredArgsConstructor
@Slf4j
@Order(10)  // SchemaMigration sonrası
public class DemoSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final JobListingRepository jobListingRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final ApplicationRepository applicationRepository;
    private final ReviewRepository reviewRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String DEMO_PASSWORD_RAW = "Demo1234!";
    private static final String SENTINEL_EMAIL = "demo-aday1@test.com";
    private final Random random = new Random(42);  // deterministic

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.findByEmail(SENTINEL_EMAIL).isPresent()) {
            log.info("[DEMO-SEED] Sentinel '{}' zaten var — atlanıyor", SENTINEL_EMAIL);
            return;
        }
        log.info("[DEMO-SEED] Demo verisi oluşturuluyor...");

        String pwd = passwordEncoder.encode(DEMO_PASSWORD_RAW);

        // ── 1) Adaylar ────────────────────────────────────────
        List<User> candidates = new ArrayList<>();
        String[] candidateNames = {
                "Ahmet Yılmaz", "Ayşe Demir", "Mehmet Kaya", "Fatma Çelik",
                "Mustafa Şahin", "Zeynep Arslan", "Ali Doğan", "Elif Aydın",
                "Hüseyin Özdemir", "Merve Polat"
        };
        Position[] positions = Position.values();
        String[] districts = { "Beşiktaş", "Kadıköy", "Şişli", "Beyoğlu", "Üsküdar", "Fatih" };
        for (int i = 0; i < candidateNames.length; i++) {
            int age = 18 + random.nextInt(40);  // 18-57
            User c = User.builder()
                    .email("demo-aday" + (i + 1) + "@test.com")
                    .password(pwd)
                    .fullName(candidateNames[i])
                    .role(Role.CANDIDATE)
                    .phone("0555" + String.format("%07d", 1000000 + i))
                    .district(districts[i % districts.length])
                    .birthDate(LocalDate.now().minusYears(age))
                    .gender(i % 2 == 0 ? Gender.MALE : Gender.FEMALE)
                    .education(i % 3 == 0 ? EducationLevel.UNIVERSITY_GRADUATE : EducationLevel.HIGH_SCHOOL)
                    .isStudent(i % 3 == 0)
                    .strikesRemaining(i % 3 == 0 ? 5 : 3)
                    .enabled(true)
                    .languages(new HashSet<>(Set.of(Language.TURKISH)))
                    .availabilityTypes(new HashSet<>(Set.of(JobType.DAILY, JobType.PART_TIME)))
                    .preferredDistricts(new HashSet<>(Set.of(districts[i % districts.length])))
                    .preferredPositions(new HashSet<>(Set.of(positions[i % positions.length])))
                    .build();
            candidates.add(userRepository.save(c));
        }

        // ── 2) İşletme sahipleri + işletmeler ────────────────
        record BizSeed(String name, BusinessType type, String district, String desc) {}
        BizSeed[] bizDefs = {
                new BizSeed("Lounge Hotel İstanbul",   BusinessType.HOTEL,
                        "Şişli", "4 yıldızlı şehir oteli, Mecidiyeköy merkez"),
                new BizSeed("Boğaz Manzara Restaurant", BusinessType.RESTAURANT,
                        "Beşiktaş", "Bebek sahilinde balık restoranı"),
                new BizSeed("Cafe Köşe",                BusinessType.CAFE,
                        "Kadıköy", "Moda'da bohem kafe, kahvaltı + brunch"),
                new BizSeed("Grand Beyoğlu",            BusinessType.HOTEL,
                        "Beyoğlu", "İstiklal yakını butik otel"),
                new BizSeed("Anadolu Sofrası",          BusinessType.RESTAURANT,
                        "Üsküdar", "Geleneksel Türk mutfağı"),
                new BizSeed("Coffee Lab",               BusinessType.CAFE,
                        "Beşiktaş", "Specialty coffee, third-wave"),
        };
        List<Business> businesses = new ArrayList<>();
        for (int i = 0; i < bizDefs.length; i++) {
            BizSeed bd = bizDefs[i];
            User owner = User.builder()
                    .email("demo-isletme" + (i + 1) + "@test.com")
                    .password(pwd)
                    .fullName(bd.name + " Yöneticisi")
                    .role(Role.BUSINESS_OWNER)
                    .phone("0212" + String.format("%07d", 2000000 + i))
                    .enabled(true)
                    .strikesRemaining(3)
                    .languages(new HashSet<>())
                    .availabilityTypes(new HashSet<>())
                    .preferredDistricts(new HashSet<>())
                    .preferredPositions(new HashSet<>())
                    .build();
            owner = userRepository.save(owner);

            Business b = Business.builder()
                    .name(bd.name)
                    .type(bd.type)
                    .city("Istanbul")
                    .district(bd.district)
                    .address("Demo Mahallesi Sokak No: " + (i + 1))
                    .phone("0212" + String.format("%07d", 5000000 + i))
                    .description(bd.desc)
                    .owner(owner)
                    .build();
            businesses.add(businessRepository.save(b));
        }

        // ── 3) İlanlar + slotlar ─────────────────────────────
        record ListingSeed(int bizIdx, String title, Position pos, Shift shift, int minSal, int maxSal) {}
        ListingSeed[] listingDefs = {
                new ListingSeed(0, "Sabah vardiyası garson",        Position.WAITER,      Shift.MORNING, 700, 1000),
                new ListingSeed(0, "Resepsiyon görevlisi (gece)",   Position.RECEPTION,   Shift.NIGHT,   900, 1300),
                new ListingSeed(0, "Kat hizmetleri personeli",      Position.HOUSEKEEPING, Shift.MORNING, 800, 1100),
                new ListingSeed(1, "Akşam garson - balık restoran", Position.WAITER,      Shift.EVENING, 800, 1200),
                new ListingSeed(1, "Bulaşıkçı",                     Position.DISHWASHER,  Shift.EVENING, 600, 900),
                new ListingSeed(1, "Mutfak personeli",              Position.KITCHEN_STAFF, Shift.EVENING, 1000, 1500),
                new ListingSeed(2, "Hafta sonu kahveci/barista",    Position.WAITER,      Shift.MORNING, 750, 1000),
                new ListingSeed(2, "Açılış vardiyası",              Position.WAITER,      Shift.MORNING, 700, 950),
                new ListingSeed(3, "Bellboy - butik otel",          Position.BELLBOY,     Shift.EVENING, 750, 1050),
                new ListingSeed(3, "Güvenlik (gece)",               Position.SECURITY,    Shift.NIGHT,   900, 1200),
                new ListingSeed(4, "Garson - Türk lokantası",       Position.WAITER,      Shift.EVENING, 700, 1000),
                new ListingSeed(4, "Aşçı yardımcısı",               Position.KITCHEN_STAFF, Shift.EVENING, 900, 1300),
                new ListingSeed(5, "Barista - 3rd wave",            Position.WAITER,      Shift.MORNING, 850, 1200),
                new ListingSeed(5, "Bulaşıkçı (yarım gün)",         Position.DISHWASHER,  Shift.MORNING, 500, 750),
                new ListingSeed(5, "Akşam vardiyası",               Position.WAITER,      Shift.EVENING, 800, 1100),
        };
        List<JobListing> listings = new ArrayList<>();
        for (ListingSeed ls : listingDefs) {
            Business biz = businesses.get(ls.bizIdx);
            JobListing l = JobListing.builder()
                    .business(biz)
                    .position(ls.pos)
                    .jobType(JobType.DAILY)
                    .shift(ls.shift)
                    .title(ls.title)
                    .description("Demo ilan: " + ls.title + " · " + biz.getName())
                    .requirements("Ekip çalışması, gülümseme. Demo data.")
                    .salaryMin(java.math.BigDecimal.valueOf(ls.minSal))
                    .salaryMax(java.math.BigDecimal.valueOf(ls.maxSal))
                    .status(ListingStatus.ACTIVE)
                    .build();
            l = jobListingRepository.save(l);

            // 1-3 slot — bazıları geçmiş, bazıları gelecek
            int slotCount = 1 + random.nextInt(3);
            for (int s = 0; s < slotCount; s++) {
                int dayOffset = -30 + random.nextInt(60);  // -30..+30 gün
                LocalDate date = LocalDate.now().plusDays(dayOffset);
                LocalTime start = ls.shift == Shift.MORNING ? LocalTime.of(8, 0)
                              : ls.shift == Shift.EVENING ? LocalTime.of(16, 0)
                              : LocalTime.of(22, 0);
                LocalTime end = start.plusHours(8);
                ShiftSlot slot = ShiftSlot.builder()
                        .jobListing(l)
                        .date(date)
                        .startTime(start)
                        .endTime(end)
                        .slotsNeeded(1 + random.nextInt(3))
                        .slotsFilled(0)
                        .build();
                shiftSlotRepository.save(slot);
            }
            listings.add(l);
        }

        // ── 4) Başvurular ────────────────────────────────────
        // Her aday 4-8 başvuru yapar, %30 accepted / %15 rejected / %15 reviewing / %40 pending
        List<Application> allApps = new ArrayList<>();
        for (User cand : candidates) {
            int appCount = 4 + random.nextInt(5);
            List<JobListing> shuffled = new ArrayList<>(listings);
            Collections.shuffle(shuffled, random);
            for (int j = 0; j < Math.min(appCount, shuffled.size()); j++) {
                JobListing l = shuffled.get(j);
                ApplicationStatus status;
                double r = random.nextDouble();
                if (r < 0.30)      status = ApplicationStatus.ACCEPTED;
                else if (r < 0.45) status = ApplicationStatus.REJECTED;
                else if (r < 0.60) status = ApplicationStatus.REVIEWING;
                else               status = ApplicationStatus.PENDING;

                // Tarih: 1-30 gün önce başvuru
                int daysAgo = 1 + random.nextInt(30);
                LocalDateTime createdAt = LocalDateTime.now().minusDays(daysAgo);

                // Slot seçimi (rastgele bir slot)
                List<ShiftSlot> listingSlots = shiftSlotRepository.findAllByJobListingId(l.getId());
                Set<ShiftSlot> requested = new HashSet<>();
                if (!listingSlots.isEmpty()) {
                    requested.add(listingSlots.get(random.nextInt(listingSlots.size())));
                }

                Application app = Application.builder()
                        .candidate(cand)
                        .jobListing(l)
                        .status(status)
                        .coverLetter("Demo başvuru. " + cand.getFullName() + " olarak " + l.getTitle() + " için başvuruyorum.")
                        .deadline(createdAt.plusDays(7))
                        .createdAt(createdAt)
                        .requestedSlots(requested)
                        .build();
                if (status == ApplicationStatus.ACCEPTED || status == ApplicationStatus.REJECTED) {
                    app.setReviewedAt(createdAt.plusHours(2 + random.nextInt(48)));
                }
                allApps.add(applicationRepository.save(app));
            }
        }

        // ── 5) Yorumlar (ACCEPTED + slot tarihi geçmiş olanların ~%70'i) ──
        int reviewCount = 0;
        for (Application app : allApps) {
            if (app.getStatus() != ApplicationStatus.ACCEPTED) continue;
            // Slot tarihi geçmiş mi?
            boolean past = app.getRequestedSlots().stream()
                    .map(ShiftSlot::getDate)
                    .allMatch(d -> d.isBefore(LocalDate.now()));
            if (!past) continue;
            if (random.nextDouble() > 0.70) continue;  // %30'u henüz puanlamadı

            int rating = 3 + random.nextInt(3);  // 3-5 yıldız ağırlıklı
            Review rev = Review.builder()
                    .application(app)
                    .byRole("CANDIDATE")
                    .rating(rating)
                    .comment("Demo yorum: deneyimim güzeldi. " + rating + " yıldız.")
                    .createdAt(LocalDateTime.now().minusDays(random.nextInt(20)))
                    .build();
            reviewRepository.save(rev);
            reviewCount++;
        }

        // ── 6) Sohbetler + mesajlar (4 örnek) ────────────────
        int chatCount = 0;
        for (int i = 0; i < Math.min(4, allApps.size()); i++) {
            Application app = allApps.get(i);
            if (app.getStatus() != ApplicationStatus.ACCEPTED) continue;
            User cand = app.getCandidate();
            User owner = app.getJobListing().getBusiness().getOwner();

            Conversation conv = Conversation.builder()
                    .candidate(cand)
                    .businessOwner(owner)
                    .application(app)
                    .build();
            conv = conversationRepository.save(conv);

            // 2-4 mesaj
            String[] msgs = {
                    "Merhaba, ne zaman başlayabilirim?",
                    "Selam, yarın 09:00'da gelirsen başlarız.",
                    "Tamam, anlaştık. Form doldurmam gereken bir şey var mı?",
                    "Geldiğinde imzalatırız.",
            };
            for (int m = 0; m < 2 + random.nextInt(3); m++) {
                User sender = m % 2 == 0 ? cand : owner;
                Message msg = Message.builder()
                        .conversation(conv)
                        .sender(sender)
                        .content(msgs[m % msgs.length])
                        .isRead(m < 3)  // sonuncu okunmamış
                        .sentAt(LocalDateTime.now().minusHours(48 - m * 2))
                        .build();
                messageRepository.save(msg);
                conv.setLastMessageAt(msg.getSentAt());
            }
            conversationRepository.save(conv);
            chatCount++;
        }

        log.info("[DEMO-SEED] ✓ {} aday, {} işletme, {} ilan, {} başvuru, {} yorum, {} sohbet",
                candidates.size(), businesses.size(), listings.size(),
                allApps.size(), reviewCount, chatCount);
        log.info("[DEMO-SEED] Giriş: demo-aday1@test.com / demo-isletme1@test.com — şifre: {}",
                DEMO_PASSWORD_RAW);
    }
}
