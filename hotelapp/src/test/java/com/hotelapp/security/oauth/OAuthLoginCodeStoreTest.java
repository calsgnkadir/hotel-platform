package com.hotelapp.security.oauth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class OAuthLoginCodeStoreTest {

    /** Elle ilerletilen saat. */
    static final class MutableClock extends Clock {
        final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T10:00:00Z"));
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    }

    @Test
    void codeIsSingleUse() {
        OAuthLoginCodeStore store = new OAuthLoginCodeStore();
        String code = store.issue(42L);

        assertThat(code).hasSizeGreaterThanOrEqualTo(43);   // 256 bit base64url
        assertThat(store.consume(code)).contains(42L);
        assertThat(store.consume(code)).isEmpty();          // ikinci kullanım reddedilir
    }

    @Test
    void peekDoesNotConsume_andRespectsTtl() {
        MutableClock clock = new MutableClock();
        OAuthLoginCodeStore store = new OAuthLoginCodeStore(clock);
        String code = store.issue(9L);

        assertThat(store.peek(code)).contains(9L);
        assertThat(store.peek(code)).contains(9L);          // KVKK onayı eksikse aynı kodla tekrar
        assertThat(store.peek("yanlis")).isEmpty();
        assertThat(store.consume(code)).contains(9L);
        assertThat(store.peek(code)).isEmpty();              // tüketildi

        String other = store.issue(10L);
        clock.now.set(clock.now.get().plusSeconds(OAuthLoginCodeStore.TTL_SECONDS));
        assertThat(store.peek(other)).isEmpty();
    }

    @Test
    void codeExpiresAfterTtl() {
        MutableClock clock = new MutableClock();
        OAuthLoginCodeStore store = new OAuthLoginCodeStore(clock);
        String code = store.issue(7L);

        clock.now.set(clock.now.get().plusSeconds(OAuthLoginCodeStore.TTL_SECONDS));
        assertThat(store.consume(code)).isEmpty();
    }

    @Test
    void unknownOrMalformedCodesRejected() {
        OAuthLoginCodeStore store = new OAuthLoginCodeStore();
        store.issue(1L);
        assertThat(store.consume(null)).isEmpty();
        assertThat(store.consume("")).isEmpty();
        assertThat(store.consume("yok")).isEmpty();
        assertThat(store.consume("x".repeat(500))).isEmpty();
        assertThat(store.issue(1L)).isNotEqualTo(store.issue(1L));
    }
}
