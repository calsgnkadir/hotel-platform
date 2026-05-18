package com.hotelapp.repository;

import com.hotelapp.entity.JobListing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface JobListingRepository
        extends JpaRepository<JobListing, Long>, JpaSpecificationExecutor<JobListing> {

    List<JobListing> findAllByBusiness_OwnerId(Long ownerId);
}
