-- Faz: Belge son-kullanma tarihi + hatırlatıcı idempotency damgası.
-- Süreli belgeler (hijyen/sağlık, adli sicil) için geçerlilik takibi:
--  * expires_at              : son kullanma tarihi (null = süresiz)
--  * expiry_reminder_sent_at : son-kullanma yaklaşınca aday tek kez uyarılır
ALTER TABLE documents
    ADD COLUMN expires_at DATE NULL,
    ADD COLUMN expiry_reminder_sent_at DATETIME NULL;

-- İşletmenin "belgesi geçerli" filtresi ve hatırlatıcı taraması bu kolonu tarar.
CREATE INDEX idx_documents_expires_at ON documents (expires_at);
