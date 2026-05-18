package com.hotelapp.repository;

import com.hotelapp.entity.DocumentRequest;
import com.hotelapp.enums.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DocumentRequestRepository extends JpaRepository<DocumentRequest, Long> {

    List<DocumentRequest> findAllByApplicationId(Long applicationId);

    Optional<DocumentRequest> findByApplicationIdAndDocumentType(Long applicationId, DocumentType documentType);

    @Query("""
        SELECT COUNT(dr) > 0
        FROM DocumentRequest dr
        WHERE dr.application.jobListing.business.owner.id = :ownerId
          AND dr.application.candidate.id = :candidateId
          AND dr.documentType = :docType
          AND dr.status = 'GRANTED'
    """)
    boolean hasGrantedAccess(
            @Param("ownerId") Long ownerId,
            @Param("candidateId") Long candidateId,
            @Param("docType") DocumentType docType
    );
}
