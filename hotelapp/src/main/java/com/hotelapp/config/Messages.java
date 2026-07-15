package com.hotelapp.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/**
 * FAZ 12.1 — MessageSource sarmalayici.
 *
 * Aktif locale'i LocaleContextHolder'dan alir (AcceptHeaderLocaleResolver
 * request'in Accept-Language header'indan doldurur). Key bulunamazsa
 * key'in kendisini doner (crash yerine gorulur fallback).
 */
@Component
@RequiredArgsConstructor
public class Messages {

    private final MessageSource messageSource;

    public String get(String key, Object... args) {
        return messageSource.getMessage(key, args, key, LocaleContextHolder.getLocale());
    }
}
