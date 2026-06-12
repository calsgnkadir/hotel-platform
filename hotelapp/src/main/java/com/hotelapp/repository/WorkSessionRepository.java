package com.hotelapp.repository;

import com.hotelapp.entity.WorkSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkSessionRepository extends JpaRepository<WorkSession, Long> {

    /** Bir adayin verilen basvurusunda acik (clockOutAt null) session — clock-out icin */
    Optional<WorkSession> findFirstByApplicationIdAndClockOutAtIsNull(Long applicationId);

    /** Bir adayin TUM acik session'lari — clock-in once kontrol (en fazla 1 olmali) */
    List<WorkSession> findByApplicationCandidateIdAndClockOutAtIsNull(Long candidateId);

    /** Bir basvurunun tum session'lari (gecmis sayfasi icin) */
    List<WorkSession> findByApplicationIdOrderByClockInAtDesc(Long applicationId);
}
