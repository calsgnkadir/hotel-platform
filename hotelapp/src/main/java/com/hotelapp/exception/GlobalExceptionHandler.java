package com.hotelapp.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler — F0.5 fix:
 *   ESKİ:  RuntimeException → her şey 400. NPE/Hibernate hataları kullanıcıya
 *          "Bad Request" gibi gelirdi → false alarm, debug kabusu.
 *   YENİ:  Spesifik server hataları 500 + log. Sadece **gerçekten** client hatası
 *          olan tipler 400/422/403.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // 404 — kayıt bulunamadı
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // 422 — iş kuralı ihlali
    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<Map<String, Object>> handleBusinessRule(BusinessRuleException ex) {
        return build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    }

    // 403 — kaynak başka kullanıcıya ait
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorized(UnauthorizedException ex) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    // 403 — Spring Security rol kontrolü
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "Bu işlemi yapmaya yetkiniz yok");
    }

    // 401 — hatalı şifre / geçersiz token
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        return build(HttpStatus.UNAUTHORIZED, "Email veya şifre hatalı");
    }

    // 400 — @Valid validation hatası, alan bazlı liste döner
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Geçersiz değer",
                        (existing, duplicate) -> existing
                ));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", 400);
        body.put("error", "Validation failed");
        body.put("fields", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    // 413 — dosya boyutu aşıldı
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "Dosya boyutu izin verilen limiti aşıyor (max 15 MB)");
    }

    // 400 — URL path parametresinin tipi yanlış (örn /api/users/abc beklenirken int)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return build(HttpStatus.BAD_REQUEST, "Parametre formatı geçersiz: " + ex.getName());
    }

    // 404 — Spring "no handler found" (yanlış URL)
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoHandler(NoHandlerFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "Endpoint bulunamadı: " + ex.getRequestURL());
    }

    // 409 — DB constraint ihlali (unique key, foreign key vs)
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException ex) {
        log.warn("DB integrity violation", ex);
        // Specific yorumlama yapmak yerine generic mesaj — DB schema detayı sızdırmasın
        String msg = "Veritabanı kuralı ihlali (örn: kayıt zaten var)";
        return build(HttpStatus.CONFLICT, msg);
    }

    // 400 — IllegalArgumentException = "client'tan gelen veri geçersiz"
    // (NPE/IllegalStateException FARKLI — onlar 500, aşağıda)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArg(IllegalArgumentException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    // 500 — gerçek server hataları: NPE, IllegalStateException, DB connection vb.
    // Kullanıcıya detay sızdırma, ama log'a tam stack yaz.
    @ExceptionHandler({
            NullPointerException.class,
            IllegalStateException.class,
            ArithmeticException.class,
            ClassCastException.class
    })
    public ResponseEntity<Map<String, Object>> handleServerError(RuntimeException ex) {
        log.error("Sunucu hatası ({}): {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "Sunucuda bir sorun oluştu. Lütfen tekrar deneyin.");
    }

    // 500 — yakalanmayan diğer RuntimeException'lar (son çare).
    // ÖNCE 400 dönerdi → yanlıştı. Şimdi 500 + log.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex) {
        log.error("Yakalanmayan RuntimeException ({}): {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "Beklenmeyen bir hata oluştu. Sorun devam ederse destek ekibimize bildirin.");
    }

    // 500 — checked Exception'lar da buraya düşer (Throwable yakalama son çare)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAny(Exception ex) {
        log.error("Yakalanmayan Exception ({}): {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "Sistem hatası. Lütfen daha sonra tekrar deneyin.");
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
