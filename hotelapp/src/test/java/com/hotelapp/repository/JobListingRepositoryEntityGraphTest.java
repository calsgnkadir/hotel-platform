package com.hotelapp.repository;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N+1 REGRESYON KORUMASI — JobListing.business LAZY.
 *
 * Ilan listeleme/siralama akislari her ilanda business alanina eriyor
 * (ranking'de scoreListing -> getBusiness().getDistrict(), response
 * mapping'de toResponse). Duz findAll(spec) her DISTINCT isletme icin
 * ayri SELECT atiyordu. JobListingRepository.findAll(Specification)
 * @EntityGraph(attributePaths="business") ile override edildi.
 *
 * Bu test entity graph'in GERCEKTEN uygulandigini kanitlar: persistence
 * context temizlendikten sonra findAll(spec) donen her listing'in
 * business'i, henuz erisilmeden EAGER yuklu (initialized) olmali. Override
 * sessizce yok sayilsaydi business bir lazy proxy olurdu (initialized=false)
 * ve ilk getDistrict() cagrisi ek SELECT atardi.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class JobListingRepositoryEntityGraphTest {

    @Autowired private JobListingRepository jobListingRepository;
    @Autowired private EntityManager em;

    private User owner(String email) {
        return User.builder()
                .email(email).password("x").fullName("Sahip")
                .role(Role.BUSINESS_OWNER)
                .isStudent(false).strikesRemaining(3).enabled(true)
                .build();
    }

    private Business business(String name, String district, User owner) {
        return Business.builder()
                .name(name).type(BusinessType.RESTAURANT)
                .city("Istanbul").district(district).owner(owner)
                .build();
    }

    private JobListing listing(String title, Business biz) {
        return JobListing.builder()
                .business(biz).position(Position.WAITER).jobType(JobType.PERMANENT)
                .title(title).description("demo").status(ListingStatus.ACTIVE)
                .build();
    }

    @Test
    void findAllSpec_business_eagerFetch_ile_gelir_lazy_proxy_degil() {
        // 3 ayri isletme, her birinde 1 ilan -> duz lazy'de 3 ekstra SELECT
        for (String d : List.of("Kadikoy", "Sisli", "Besiktas")) {
            User o = em.merge(owner("o-" + d + "@test.com"));
            Business b = em.merge(business("Biz-" + d, d, o));
            em.persist(listing("Garson " + d, b));
        }
        em.flush();
        // Persistence context'i temizle: sonraki okuma DB'den gercek sorgu olsun
        em.clear();

        Specification<JobListing> spec =
                (root, q, cb) -> cb.equal(root.get("status"), ListingStatus.ACTIVE);

        List<JobListing> result = jobListingRepository.findAll(spec);

        assertThat(result).hasSize(3);
        // Entity graph calisiyorsa: business HENUZ erisilmeden initialized olmali.
        for (JobListing l : result) {
            assertThat(Hibernate.isInitialized(l.getBusiness()))
                    .as("business, entity graph ile eager yuklenmeli (N+1 fix)")
                    .isTrue();
            // District de erisilebilir olmali (scoreListing bunu okuyor)
            assertThat(l.getBusiness().getDistrict()).isNotBlank();
        }
    }
}
