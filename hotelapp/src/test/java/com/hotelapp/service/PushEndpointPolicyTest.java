package com.hotelapp.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class PushEndpointPolicyTest {

    private final PushEndpointPolicy policy = new PushEndpointPolicy();

    @ParameterizedTest
    @ValueSource(strings = {
            "https://fcm.googleapis.com/fcm/send/dAbC123:APA91b",
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
            "https://web.push.apple.com/QGuQyavXutnMQ",
            "https://api.push.apple.com/3/device/abc",
            "https://db5p.notify.windows.com/w/?token=BQYAAAB",
            "https://FCM.GOOGLEAPIS.COM/fcm/send/x",
    })
    void realPushServices_allowed(String endpoint) {
        assertThat(policy.isAllowed(endpoint)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://fcm.googleapis.com/fcm/send/x",              // https değil
            "https://127.0.0.1/push",                             // yerel
            "https://localhost/push",
            "https://169.254.169.254/latest/meta-data",           // bulut metadata
            "https://10.0.0.5/internal",
            "https://fcm.googleapis.com:8443/fcm/send/x",         // farklı port
            "https://user:pass@fcm.googleapis.com/fcm/send/x",    // kullanıcı bilgisi
            "https://fcm.googleapis.com.evil.com/x",              // benzer alan adı
            "https://evilpush.apple.com.attacker.net/x",
            "https://notpush.apple.com/x",                        // .push.apple.com değil
            "file:///etc/passwd",
            "not a url",
            "",
    })
    void otherAddresses_rejected(String endpoint) {
        assertThat(policy.isAllowed(endpoint)).isFalse();
    }
}
