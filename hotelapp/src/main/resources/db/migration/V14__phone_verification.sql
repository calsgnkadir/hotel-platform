-- Faz: Telefon doğrulama (OTP/SMS). Opsiyonel — kayıt akışını bloklamaz.
--  * phone_verified_at    : doğrulandığı an (null = doğrulanmadı)
--  * phone_otp_code       : bekleyen 6 haneli kod (doğrulanınca temizlenir)
--  * phone_otp_expires_at : kodun son geçerlilik anı
--  * phone_otp_sent_at    : son gönderim (tekrar-gönder soğuma penceresi için)
--  * phone_otp_attempts   : yanlış deneme sayacı (brute-force freni)
ALTER TABLE users
    ADD COLUMN phone_verified_at DATETIME NULL,
    ADD COLUMN phone_otp_code VARCHAR(12) NULL,
    ADD COLUMN phone_otp_expires_at DATETIME NULL,
    ADD COLUMN phone_otp_sent_at DATETIME NULL,
    ADD COLUMN phone_otp_attempts INT NOT NULL DEFAULT 0;
