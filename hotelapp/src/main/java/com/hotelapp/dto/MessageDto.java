package com.hotelapp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** Tek mesaj — chat bubble için. */
@Data
@Builder
public class MessageDto {
    private Long id;
    private Long senderId;
    private String senderName;
    private String content;
    private LocalDateTime sentAt;
    private Boolean isRead;
    /** İstemci tarafı için: bu mesaj benim mi? (kullanıcı bazlı projeksiyon) */
    private Boolean mine;
}
