package com.hotelapp.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FAZ 12 — MessageSource + Messages helper i18n testi.
 *
 * Spring context'e gerek yok: ResourceBundleMessageSource'u dogrudan
 * messages_tr/en.properties uzerine kurup key cozumlemesini dogrular.
 */
class MessagesTest {

    private Messages buildMessages() {
        ResourceBundleMessageSource src = new ResourceBundleMessageSource();
        src.setBasename("messages");
        src.setDefaultEncoding("UTF-8");
        src.setUseCodeAsDefaultMessage(true);
        return new Messages(src);
    }

    @AfterEach
    void reset() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    @DisplayName("TR locale: key Turkce cozulur")
    void turkishResolution() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("tr"));
        String msg = buildMessages().get("error.application.notOwner");
        assertThat(msg).isEqualTo("Bu basvuru size ait degil");
    }

    @Test
    @DisplayName("EN locale: key Ingilizce cozulur")
    void englishResolution() {
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        String msg = buildMessages().get("error.application.notOwner");
        assertThat(msg).isEqualTo("This application does not belong to you");
    }

    @Test
    @DisplayName("Arg interpolation: {0} {1} doldurulur")
    void argInterpolation() {
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        String msg = buildMessages().get("error.resource.notFound", "Listing", 42L);
        assertThat(msg).isEqualTo("Listing not found: 42");
    }

    @Test
    @DisplayName("Bilinmeyen key: key'in kendisi doner (crash yok)")
    void unknownKeyFallback() {
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        String msg = buildMessages().get("error.does.not.exist");
        assertThat(msg).isEqualTo("error.does.not.exist");
    }

    @Test
    @DisplayName("BusinessRuleException.keyed message key + args tasir")
    void businessRuleKeyed() {
        var ex = com.hotelapp.exception.BusinessRuleException.keyed("error.listing.slotNotBelong", 7L);
        assertThat(ex.getMessageKey()).isEqualTo("error.listing.slotNotBelong");
        assertThat(ex.getMessageArgs()).containsExactly(7L);
    }

    @Test
    @DisplayName("Legacy BusinessRuleException(String) key tasimaz (backward compat)")
    void businessRuleLegacy() {
        var ex = new com.hotelapp.exception.BusinessRuleException("Duz Turkce mesaj");
        assertThat(ex.getMessageKey()).isNull();
        assertThat(ex.getMessage()).isEqualTo("Duz Turkce mesaj");
    }
}
