package com.hotelapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Yeni bir sohbet başlatmak için istek.
 * Karşı taraf user id'si zorunlu; başvuru referansı opsiyonel.
 * Aynı çift için sohbet zaten varsa onu döner (idempotent).
 */
@Data
public class StartConversationRequest {

    @NotNull(message = "Karşı taraf zorunlu")
    private Long otherPartyId;

    /** Opsiyonel: bir başvuru bağlamından başlatıldıysa. */
    private Long applicationId;
}
