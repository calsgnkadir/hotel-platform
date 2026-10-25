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
}
