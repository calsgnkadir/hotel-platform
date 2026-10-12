package com.hotelapp.exception;

/**
 * Süresi dolmuş HOLD / yedek teklifine yanıt → 422.
 *
 * <p>Bu exception'ı fırlatan metotlar {@code noRollbackFor = OfferExpiredException.class}
 * ile işaretlidir: EXPIRED durumu ve sıradaki yedeğe geçiş kalıcı olur (eskiden
 * exception rollback'i EXPIRED'ı geri alıyor, scheduler aynı teklifi tekrar
 * işleyip bildirimi ikinci kez gönderiyordu). Yalnız durum değişikliğinden önce,
 * başka yazma yokken fırlatılmalıdır.
 */
public class OfferExpiredException extends BusinessRuleException {

    public OfferExpiredException(String message) {
        super(message);
    }

    private OfferExpiredException(String key, Object[] args) {
        super(key, args);
    }

    public static OfferExpiredException keyed(String key, Object... args) {
        return new OfferExpiredException(key, args);
    }
}
