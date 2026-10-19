package com.hotelapp.exception;

import com.hotelapp.config.Messages;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Frontend sözleşmesi: kodlu hatalarda gövdede {@code code}; diğerlerinde alan yok. */
class GlobalExceptionHandlerCodeTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(mock(Messages.class));

    @Test
    void emailNotVerified_is403WithCode() {
        var res = handler.handleUnauthorized(new EmailNotVerifiedException());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res.getBody()).containsEntry("message", "Devam etmek için e-posta adresini doğrula.")
                .containsEntry("code", "EMAIL_NOT_VERIFIED");
    }

    @Test
    void consentRequired_is422WithCode() {
        var res = handler.handleBusinessRule(new ConsentRequiredException());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody()).containsEntry("code", "CONSENT_REQUIRED");
    }

    @Test
    void plainErrorsHaveNoCode() {
        assertThat(handler.handleBusinessRule(new BusinessRuleException("x")).getBody()).doesNotContainKey("code");
        assertThat(handler.handleUnauthorized(new UnauthorizedException("y")).getBody()).doesNotContainKey("code");
        var unavailable = handler.handleUnavailable(new ServiceUnavailableException("z"));
        assertThat(unavailable.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(unavailable.getBody()).containsEntry("message", "z").doesNotContainKey("code");
    }
}
