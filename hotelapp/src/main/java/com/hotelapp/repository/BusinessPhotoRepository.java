package com.hotelapp.repository;

import com.hotelapp.entity.BusinessPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BusinessPhotoRepository extends JpaRepository<BusinessPhoto, Long> {
    List<BusinessPhoto> findAllByBusinessIdOrderByCreatedAtDesc(Long businessId);
}
