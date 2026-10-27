package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.enums.SalaryType;
import com.hotelapp.repository.JobListingRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;

import java.math.BigDecimal;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/** Actual H2 aggregate types and SQL generation, including Turkish-locale MIN normalization. */
@DataJpaTest(showSql = false, properties = "spring.datasource.url=jdbc:h2:mem:salary_benchmark;MODE=MySQL;DB_CLOSE_DELAY=-1")
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(initializers = SalaryBenchmarkJpaTest.TurkishLocaleInitializer.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SalaryBenchmarkJpaTest {
    private static final Locale ORIGINAL_LOCALE = Locale.getDefault();
    @Autowired JobListingRepository listings;
    @Autowired EntityManager em;

    public static class TurkishLocaleInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
        }
    }

    @AfterAll
    static void restoreLocale() {
        Locale.setDefault(ORIGINAL_LOCALE);
    }

    @Test
    void decimalSalaryAggregatesWorkUnderTurkishLocaleAndKeepExistingFilters() {
        assertThat(Locale.getDefault().getLanguage()).isEqualTo("tr");
        Business business = business();
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "100.10", "200.10");
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "100.20", null);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "100.30", "200.30");
        listing(business, Position.WAITER, ListingStatus.CLOSED, "9000.00", "9999.00");
        listing(business, Position.WAITER, ListingStatus.PAUSED, "8000.00", "8888.00");
        listing(business, Position.KITCHEN_STAFF, ListingStatus.ACTIVE, "7000.00", "7777.00");
        listing(business, Position.WAITER, ListingStatus.ACTIVE, null, "6000.00");
        em.flush();
        em.clear();

        var aggregate = listings.salaryBenchmark(Position.WAITER, SalaryType.HOURLY);
        assertThat(aggregate.getListingCount()).isEqualTo(3L);
        assertThat(aggregate.getAverageMinimum()).isInstanceOf(Double.class);
        assertThat(aggregate.getMinimum()).isInstanceOf(BigDecimal.class);
        var response = service().getSalaryBenchmark(Position.WAITER, SalaryType.HOURLY);

        assertThat(response.getPosition()).isEqualTo("WAITER");
        assertThat(response.getSalaryType()).isEqualTo("HOURLY");
        assertThat(response.getCount()).isEqualTo(3L);
        assertThat(response.getAvgMin()).isEqualByComparingTo("100.20");
        // AVG(max) excludes the null maximum; do not divide by all three listings.
        assertThat(response.getAvgMax()).isEqualByComparingTo("200.20");
        assertThat(response.getMin()).isEqualByComparingTo("100.10");
        assertThat(response.getMax()).isEqualByComparingTo("200.30");
    }

    @Test
    void absentMaximaRemainNullWithoutLosingMinimumStatistics() {
        listing(business(), Position.WAITER, ListingStatus.ACTIVE, "150.25", null);
        em.flush();
        em.clear();

        var response = service().getSalaryBenchmark(Position.WAITER, SalaryType.HOURLY);

        assertThat(response.getCount()).isEqualTo(1L);
        assertThat(response.getAvgMin()).isEqualByComparingTo("150.25");
        assertThat(response.getMin()).isEqualByComparingTo("150.25");
        assertThat(response.getAvgMax()).isNull();
        assertThat(response.getMax()).isNull();
    }

    @Test
    void noMatchingSalaryReturnsEmptyStatistics() {
        var response = service().getSalaryBenchmark(Position.WAITER, SalaryType.HOURLY);

        assertThat(response.getPosition()).isEqualTo("WAITER");
        assertThat(response.getCount()).isZero();
        assertThat(response.getAvgMin()).isNull();
        assertThat(response.getAvgMax()).isNull();
        assertThat(response.getMin()).isNull();
        assertThat(response.getMax()).isNull();
    }

    @Test
    void hourlyDailyAndMonthlyListingsAreComparedOnlyWithinTheirOwnUnits() {
        Business business = business();
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "100.00", "200.00", SalaryType.HOURLY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "300.00", "400.00", SalaryType.HOURLY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "1000.00", "1200.00", SalaryType.DAILY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "2000.00", "2200.00", SalaryType.DAILY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "25000.00", "30000.00", SalaryType.MONTHLY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "99000.00", "99900.00", SalaryType.NEGOTIABLE);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "88000.00", "88900.00", null);
        em.flush();
        em.clear();

        var hourly = service().getSalaryBenchmark(Position.WAITER, SalaryType.HOURLY);
        assertThat(hourly.getSalaryType()).isEqualTo("HOURLY");
        assertThat(hourly.getCount()).isEqualTo(2L);
        assertThat(hourly.getAvgMin()).isEqualByComparingTo("200.00");
        assertThat(hourly.getAvgMax()).isEqualByComparingTo("300.00");
        assertThat(hourly.getMin()).isEqualByComparingTo("100.00");
        assertThat(hourly.getMax()).isEqualByComparingTo("400.00");

        var daily = service().getSalaryBenchmark(Position.WAITER, SalaryType.DAILY);
        assertThat(daily.getSalaryType()).isEqualTo("DAILY");
        assertThat(daily.getCount()).isEqualTo(2L);
        assertThat(daily.getAvgMin()).isEqualByComparingTo("1500.00");
        assertThat(daily.getAvgMax()).isEqualByComparingTo("1700.00");
        assertThat(daily.getMin()).isEqualByComparingTo("1000.00");
        assertThat(daily.getMax()).isEqualByComparingTo("2200.00");

        var monthly = service().getSalaryBenchmark(Position.WAITER, SalaryType.MONTHLY);
        assertThat(monthly.getSalaryType()).isEqualTo("MONTHLY");
        assertThat(monthly.getCount()).isEqualTo(1L);
        assertThat(monthly.getAvgMin()).isEqualByComparingTo("25000.00");
        assertThat(monthly.getAvgMax()).isEqualByComparingTo("30000.00");
    }

    @Test
    void missingOrNegotiableUnitDoesNotReturnAnAmbiguousComparison() {
        Business business = business();
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "150.00", "200.00", SalaryType.HOURLY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "1500.00", "2000.00", SalaryType.DAILY);
        listing(business, Position.WAITER, ListingStatus.ACTIVE, "25000.00", "30000.00", SalaryType.NEGOTIABLE);
        em.flush();

        for (SalaryType unit : new SalaryType[]{null, SalaryType.NEGOTIABLE}) {
            var response = service().getSalaryBenchmark(Position.WAITER, unit);
            assertThat(response.getPosition()).isEqualTo("WAITER");
            assertThat(response.getSalaryType()).isEqualTo(unit == null ? null : unit.name());
            assertThat(response.getCount()).isZero();
            assertThat(response.getAvgMin()).isNull();
            assertThat(response.getAvgMax()).isNull();
            assertThat(response.getMin()).isNull();
            assertThat(response.getMax()).isNull();
        }
    }

    private JobListingService service() {
        // Only the real repository is used by this focused aggregate-mapping method.
        return new JobListingService(null, listings, null, null, null, null, null, null, null, null);
    }

    private Business business() {
        User owner = User.builder().email("benchmark-" + System.nanoTime() + "@example.test")
                .password("test-only").fullName("Test İşletmesi").role(Role.BUSINESS_OWNER).build();
        em.persist(owner);
        Business business = Business.builder().name("Test Kafe").type(BusinessType.CAFE).owner(owner).build();
        em.persist(business);
        return business;
    }

    private void listing(Business business, Position position, ListingStatus status, String min, String max) {
        listing(business, position, status, min, max, SalaryType.HOURLY);
    }

    private void listing(Business business, Position position, ListingStatus status, String min, String max,
                         SalaryType salaryType) {
        em.persist(JobListing.builder().business(business).title("Ücret testi").description("Test")
                .position(position).jobType(JobType.DAILY).status(status).salaryType(salaryType)
                .salaryMin(min == null ? null : new BigDecimal(min))
                .salaryMax(max == null ? null : new BigDecimal(max)).build());
    }
}
