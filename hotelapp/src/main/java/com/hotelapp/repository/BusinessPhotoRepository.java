package com.hotelapp.repository;

import com.hotelapp.entity.BusinessPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BusinessPhotoRepository extends JpaRepository<BusinessPhoto, Long> {

    /** Legacy — eski kod uyumu için bırakıldı. Yeni kod findOrdered'ı kullanmalı. */
    List<BusinessPhoto> findAllByBusinessIdOrderByCreatedAtDesc(Long businessId);

    /** #86: displayOrder ASC + tiebreak için createdAt ASC. */
    List<BusinessPhoto> findAllByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(Long businessId);

    /** Bir işletmenin kapak fotosu (varsa). */
    Optional<BusinessPhoto> findByBusinessIdAndIsCoverTrue(Long businessId);

    long countByBusinessId(Long businessId);

    /** En yüksek displayOrder — yeni foto eklerken sona koymak için. */
    @Query("SELECT COALESCE(MAX(p.displayOrder), -1) FROM BusinessPhoto p WHERE p.business.id = :businessId")
    int findMaxDisplayOrder(@Param("businessId") Long businessId);

    /** Bir işletmenin tüm kapaklarını kaldır (yeni kapak set ederken önce). */
    @Modifying
    @Query("UPDATE BusinessPhoto p SET p.isCover = false WHERE p.business.id = :businessId AND p.isCover = true")
    int clearCoverForBusiness(@Param("businessId") Long businessId);
}
