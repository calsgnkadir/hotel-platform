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

    /** Attachment URL — null değilse ekli dosya/foto var */
    private String attachmentUrl;
    /** image | file | audio */
    private String attachmentType;
    /** Orijinal dosya adı (cv.pdf gibi) */
    private String attachmentName;
    /** Boyut (bayt) */
    private Long attachmentSize;

    /** Sistem mesajı mı? (otomatik gönderilen, gri stilde gösterilir) */
    private Boolean system;
}
