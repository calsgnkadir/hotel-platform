package com.hotelapp.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** KVKK: saglayici hata metni loga/last_error'a ham gitmez. */
class EmailServiceSafeErrorTest {

    @Test
    void missingProviderConfigurationCannotReportAttachmentAsSent() {
        var service = unconfiguredService();
        assertThatThrownBy(() -> service.sendWithAttachment("owner@example.test", "Roster", "<p>x</p>",
                "roster.xlsx", new byte[]{1}))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("yapılandırılmamış");
    }

    @Test
    void unavailableOutboxCannotSilentlyFallBackToAttachmentDelivery() {
        assertThatThrownBy(() -> unconfiguredService().queueWithAttachment("owner@example.test", "Roster", "<p>x</p>",
                "roster.xlsx", new byte[]{1}, 42L))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("kuyruğu kullanılamıyor");
    }

    @SuppressWarnings("unchecked")
    private EmailService unconfiguredService() {
        var provider = (org.springframework.beans.factory.ObjectProvider<OutboxService>)
                org.mockito.Mockito.mock(org.springframework.beans.factory.ObjectProvider.class);
        return new EmailService("", "sender@example.test", "Test", "https://provider.example.test", provider, 100, 100);
    }

    @Test
    @DisplayName("HTTP hatası: durum kodu + JSON 'message' alanı, e-posta maskeli; ham gövde yok")
    void httpError_onlyStatusAndMaskedMessage() {
        var ex = HttpClientErrorException.create(HttpStatus.FORBIDDEN, "Forbidden", new org.springframework.http.HttpHeaders(),
                "{\"statusCode\":403,\"message\":\"You can only send to owner.kisi@ornek.com\",\"extra\":\"gizli\"}"
                        .getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);

        String safe = EmailService.safeError(ex);

        assertThat(safe).startsWith("HTTP 403").contains("o***@o***.com")
                .doesNotContain("owner.kisi", "extra", "gizli");
    }

    @Test
    @DisplayName("Ağ hatası: hata sınıfı + maskeli kısa mesaj")
    void ioError_classAndMaskedMessage() {
        var ex = new ResourceAccessException("I/O error for x@ornek.com: " + "z".repeat(400));

        String safe = EmailService.safeError(ex);

        assertThat(safe).startsWith("ResourceAccessException: ").contains("x***@o***.com")
                .doesNotContain("x@ornek.com");
        assertThat(safe.length()).isLessThan(260);
    }
}
