package com.hotelapp.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** KVKK: log satirlarinda e-posta maskeleme yardimcisi. */
class PiiMaskingTest {

    @Test
    @DisplayName("Yerel kısım ve alan adı ilk harf dışında gizlenir, son uzantı kalır")
    void masksLocalPartAndDomain() {
        assertThat(PiiMasking.email("ayse.yilmaz@ornek.com")).isEqualTo("a***@o***.com");
        assertThat(PiiMasking.email("x@mail.sirket.com.tr")).isEqualTo("x***@m***.tr");
        assertThat(PiiMasking.email("  bob@test.com ")).isEqualTo("b***@t***.com");
    }

    @Test
    @DisplayName("Maskeli çıktı orijinal yerel kısmı ve alan adını içermez")
    void outputLeaksNeitherLocalNorDomain() {
        String masked = PiiMasking.email("gizlikisi@gizlifirma.com");
        assertThat(masked).doesNotContain("gizlikisi").doesNotContain("gizlifirma");
    }

    @Test
    @DisplayName("Noktasız alan adı, null ve biçimsiz değerler")
    void edgeCases() {
        assertThat(PiiMasking.email("root@localhost")).isEqualTo("r***@l***");
        assertThat(PiiMasking.email(null)).isNull();
        assertThat(PiiMasking.email("bozuk")).isEqualTo("***");
        assertThat(PiiMasking.email("@ornek.com")).isEqualTo("***");
        assertThat(PiiMasking.email("ayse@")).isEqualTo("***");
        assertThat(PiiMasking.email("a@b@c.com")).isEqualTo("***");
        assertThat(PiiMasking.email("")).isEqualTo("***");
    }

    @Test
    @DisplayName("Telefon: yalnız son 2 hane kalır; kısa/null değerler")
    void phoneMasking() {
        assertThat(PiiMasking.phone("+90 532 123 45 67")).isEqualTo("***67");
        assertThat(PiiMasking.phone("05321234567")).isEqualTo("***67");
        assertThat(PiiMasking.phone("123")).isEqualTo("***");
        assertThat(PiiMasking.phone(null)).isNull();
    }

    @Test
    @DisplayName("Serbest metin: e-posta ve telefon maskelenir, tarih/saat/kısa sayı dokunulmaz")
    void scrubFreeText() {
        String out = PiiMasking.scrub(
                "{\"to\":\"ayse.yilmaz@ornek.com\",\"n\":\"Ara: 0532 123 45 67 veya +90 (533) 765-43-21\","
                + "\"t\":\"2026-10-25 12:30\",\"id\":12345}");
        assertThat(out)
                .contains("a***@o***.com", "***67", "***21", "2026-10-25 12:30", "12345")
                .doesNotContain("ayse", "ornek", "0532", "765");
        assertThat(PiiMasking.scrub(null)).isNull();
        assertThat(PiiMasking.scrub("a***@o***.com")).isEqualTo("a***@o***.com");
    }
}
