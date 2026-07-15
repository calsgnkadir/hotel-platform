package com.hotelapp.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.util.List;
import java.util.Locale;

/**
 * FAZ 12.1 — Locale cozumleme.
 *
 * AcceptHeaderLocaleResolver: her request'in Accept-Language header'ini
 * okur. Desteklenen dil yoksa default TR. Frontend axios her istekte
 * kullanicinin secili dilini (localStorage 'lang') header'da gonderir.
 *
 * Not: Bu resolver stateless (session/cookie tutmaz) — JWT tabanli
 * stateless mimarimizle uyumlu.
 */
@Configuration
public class LocaleConfig {

    private static final Locale TR = Locale.forLanguageTag("tr");

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(TR);
        resolver.setSupportedLocales(List.of(TR, Locale.ENGLISH));
        return resolver;
    }

    /**
     * FAZ 12.1 — MessageSource'u explicit tanimla (auto-config'e guvenme).
     * ReloadableResourceBundleMessageSource UTF-8 properties'i dogru okur;
     * ResourceBundleMessageSource'un JDK ISO-8859-1 default'undan kacinir.
     * basename "classpath:messages" → messages_tr / messages_en.
     */
    @Bean
    public MessageSource messageSource() {
        ReloadableResourceBundleMessageSource ms = new ReloadableResourceBundleMessageSource();
        ms.setBasename("classpath:messages");
        ms.setDefaultEncoding("UTF-8");
        ms.setUseCodeAsDefaultMessage(true);
        ms.setFallbackToSystemLocale(false);
        return ms;
    }
}
