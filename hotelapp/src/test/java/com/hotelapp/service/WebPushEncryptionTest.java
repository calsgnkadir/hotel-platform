package com.hotelapp.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebPushEncryptionTest {

    private static byte[] b64(String s) { return Base64.getUrlDecoder().decode(s); }
    private static String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    @Test
    @DisplayName("RFC 8291 Ek A test vektörü: çıktı birebir aynı")
    void rfc8291_appendixA_vector() throws Exception {
        byte[] plaintext = "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8);
        byte[] asPrivate = b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        byte[] asPublic  = b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        byte[] uaPublic  = b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] salt      = b64("DGv6ra1nlYgDCS1FRnbzlw");
        byte[] auth      = b64("BTBZMqHH6r4Tts7J_aSIgg");

        KeyPair asKeys = new KeyPair(
                WebPushEncryption.publicKeyFromRaw(asPublic),
                WebPushEncryption.privateKeyFromRaw(asPrivate));

        byte[] body = WebPushEncryption.encrypt(plaintext, uaPublic, auth, asKeys, salt);

        assertThat(b64(body)).isEqualTo(
                "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
    }

    @Test
    @DisplayName("Rastgele anahtarla şifrelenen içerik tarayıcı tarafında çözülür (Türkçe karakter dahil)")
    void randomKeys_roundTrip() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair ua = gen.generateKeyPair();
        byte[] uaPublic = WebPushEncryption.rawPublic((ECPublicKey) ua.getPublic());
        byte[] auth = new byte[16];
        new java.security.SecureRandom().nextBytes(auth);
        String json = "{\"title\":\"Başvurun kabul edildi\",\"body\":\"Garson · Cafe Köşe\"}";

        byte[] body = WebPushEncryption.encrypt(json.getBytes(StandardCharsets.UTF_8), b64(uaPublic), b64(auth));

        assertThat(new String(decryptAsUserAgent(body, (ECPrivateKey) ua.getPrivate(), uaPublic, auth),
                StandardCharsets.UTF_8)).isEqualTo(json);
    }

    @Test
    @DisplayName("Push servisi sınırını aşan içerik reddedilir")
    void oversizedPayload_rejected() {
        byte[] tooBig = new byte[WebPushEncryption.MAX_PLAINTEXT + 1];
        assertThatThrownBy(() -> WebPushEncryption.encrypt(tooBig,
                "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
                "BTBZMqHH6r4Tts7J_aSIgg"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** RFC 8291 alıcı tarafı — bağımsız çözme (tarayıcının yaptığı). */
    static byte[] decryptAsUserAgent(byte[] body, ECPrivateKey uaPrivate, byte[] uaPublic, byte[] auth)
            throws Exception {
        ByteBuffer buf = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        buf.get(salt);
        assertThat(buf.getInt()).isEqualTo(4096);
        byte[] asPublic = new byte[buf.get()];
        buf.get(asPublic);
        byte[] ciphertext = new byte[buf.remaining()];
        buf.get(ciphertext);

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(uaPrivate);
        ka.doPhase(WebPushEncryption.publicKeyFromRaw(asPublic), true);
        byte[] ecdh = ka.generateSecret();

        byte[] ikm = hmac(hmac(auth, ecdh), cat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[]{1}));
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, cat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, cat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 12);

        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = c.doFinal(ciphertext);
        int end = padded.length - 1;
        while (padded[end] == 0) end--;           // dolgu
        assertThat(padded[end]).isEqualTo((byte) 2); // son kayıt ayracı
        return Arrays.copyOf(padded, end);
    }

    private static byte[] hmac(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] cat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) out.writeBytes(p);
        return out.toByteArray();
    }
}
