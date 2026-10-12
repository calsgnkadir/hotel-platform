package com.hotelapp.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;

/** KVKK: SMS DEV MODE logu numarayi maskeler, mesaj icerigini (OTP) asla yazmaz. */
class SmsServiceLogTest {

    private ListAppender<ILoggingEvent> appender;
    private Logger logger;

    @BeforeEach
    void attach() {
        logger = (Logger) LoggerFactory.getLogger(SmsService.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(appender);
    }

    @Test
    @DisplayName("DEV MODE: telefon maskeli, OTP kodu logda yok")
    void devMode_masksPhone_neverLogsOtp() {
        SmsService sms = new SmsService(false, "netgsm", "", "", "", "https://example.invalid");
        sms.send("0555 123 45 67", "Kadrom dogrulama kodun: 482913 (10 dk gecerli).");

        assertThat(appender.list).isNotEmpty();
        String all = String.join("\n", appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        assertThat(all).doesNotContain("482913").doesNotContain("5551234567").doesNotContain("0555 123 45 67");
        assertThat(all).contains("*67");
    }

    @Test
    void mask_keepsOnlyLastTwoDigits() {
        assertThat(SmsService.mask("+90 555 123 45 67")).isEqualTo("**********67");
        assertThat(SmsService.mask(null)).isEqualTo("-");
        assertThat(SmsService.mask("7")).isEqualTo("**");
    }
}
