package com.hotelapp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Sohbet listesi öğesi — sohbet başlığı + son mesaj önizlemesi + okunmamış sayım.
 * "otherParty" her zaman karşı taraftır (mevcut kullanıcıya göre).
 */
@Data
@Builder
public class ConversationDto {
    private Long id;
    private Long otherPartyId;
    private String otherPartyName;
    private String otherPartyAvatarUrl;
    /** Karşı taraf rolü — frontend ikon/etiket için (CANDIDATE / BUSINESS_OWNER) */
    private String otherPartyRole;

    /** Opsiyonel: sohbet bir başvuru bağlamında açıldıysa ilan başlığı. */
    private Long applicationId;
    private String listingTitle;

    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private Long unreadCount;
}
