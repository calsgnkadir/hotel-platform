package com.hotelapp.repository;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByCandidateId(Long candidateId);

    List<Application> findAllByJobListing_Business_OwnerId(Long ownerId);

    List<Application> findAllByJobListing_Business_OwnerIdAndStatus(Long ownerId, ApplicationStatus status);

    List<Application> findAllByJobListingId(Long jobListingId);

    @Query("SELECT a FROM Application a WHERE a.status = 'PENDING' AND a.deadline < :now")
    List<Application> findExpiredApplications(LocalDateTime now);
}
