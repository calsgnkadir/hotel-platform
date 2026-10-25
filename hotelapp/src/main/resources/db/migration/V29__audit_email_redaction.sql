-- V29 — Eski islem kayitlarindan (audit_logs) ve denetim outbox olaylarindan e-posta temizligi (KVKK).
--
-- 27683fc'den beri yeni kayitlar e-posta yerine id yaziyor:
--   actor_email = 'user:{id}' (sistem 'SYSTEM', kimliksiz '?'), details icinde 'candidateId=..' / 'userId=..'.
-- AuditLogService 'user:{id}' degerini okuma aninda guncel kullanicidan cozer; GDPR anonimlestirmesi
-- users.email'i 'deleted-{id}@deleted.local' yaptigi icin bu kayitlar da anonim gorunur.
-- Bu migration eski kayitlari ayni bicime ceker.
--
-- Kurallar:
--   * Yalniz UPDATE; DELETE ve sema degisikligi yok.
--   * Idempotent: her UPDATE yalniz hala e-posta deseni iceren satirlara dokunur; maske metinlerinde
--     '@' yoktur, ikinci calistirmada 0 satir etkilenir.
--   * Regex yalniz ASCII (karakter seti/collation'dan bagimsiz); '.', '(' ve ')' [..] ile kacirilir.
--   * EMAIL tipi outbox olaylarina (to/subject/html) DOKUNULMAZ: bekleyen gonderimler bozulmasin.
--
-- E-posta deseni: [A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}
--
-- Deneme (etkilenecek satir sayisi) sorgulari — calistirmadan once elle bakmak icin:
--   -- 1) BAN_USER / UNBAN_USER: '(<e-posta>)' -> '(userId=<target_id>)'
--   SELECT COUNT(*) FROM audit_logs
--    WHERE action IN ('BAN_USER','UNBAN_USER') AND target_type = 'USER' AND target_id IS NOT NULL
--      AND details REGEXP '[(][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}[)]';
--   -- 2) details icindeki diger tum e-postalar -> '[e-posta gizlendi]'
--   --    (migration oncesi calistirilirsa 1. adimin satirlarini da sayar)
--   SELECT COUNT(*) FROM audit_logs
--    WHERE details REGEXP '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}';
--   -- 3) actor_email e-posta, actor_id dolu -> 'user:{actor_id}'
--   SELECT COUNT(*) FROM audit_logs
--    WHERE actor_id IS NOT NULL AND actor_email LIKE '%@%';
--   -- 4) actor_email e-posta, actor_id bos -> '[gizlendi]'
--   SELECT COUNT(*) FROM audit_logs
--    WHERE actor_id IS NULL AND actor_email LIKE '%@%';
--   -- 5) AUDIT_LOG outbox payload'indaki e-postalar (islenmis, olu ve bekleyen)
--   SELECT COUNT(*) FROM outbox_events
--    WHERE event_type = 'AUDIT_LOG'
--      AND payload REGEXP '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}';
--   -- Kontrol: dokunulmayacak EMAIL olaylari
--   SELECT COUNT(*) FROM outbox_events WHERE event_type = 'EMAIL';

-- 1) Ban / ban kaldirma: hedef kullanici target_id'de (AdminController: "USER", id) — e-posta yerine
--    yeni kodla ayni 'userId=<id>' bicimi. Kosul hem action hem target_type ile sinirli; guvenli.
UPDATE `audit_logs`
   SET `details` = REGEXP_REPLACE(`details`,
         '[(][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}[)]',
         CONCAT('(userId=', `target_id`, ')'))
 WHERE `action` IN ('BAN_USER', 'UNBAN_USER')
   AND `target_type` = 'USER'
   AND `target_id` IS NOT NULL
   AND `details` REGEXP '[(][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}[)]';

-- 2) Diger tum desenler ("Aday: x", "Aday x no-show", "3 strike -> x", "yerine yedek x", vb.):
--    aday id'si target_id'den guvenle cikarilamaz (target cogunlukla APPLICATION) -> maskele.
UPDATE `audit_logs`
   SET `details` = REGEXP_REPLACE(`details`,
         '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}',
         '[e-posta gizlendi]')
 WHERE `details` REGEXP '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}';

-- 3) actor_email: actor_id varsa yeni bicim 'user:{id}' (okuma aninda guncel kullanicidan cozulur).
--    'SYSTEM', '?' ve 'user:%' degerlerinde '@' olmadigindan dokunulmaz.
UPDATE `audit_logs`
   SET `actor_email` = CONCAT('user:', `actor_id`)
 WHERE `actor_id` IS NOT NULL
   AND `actor_email` LIKE '%@%';

-- 4) actor_email: actor_id yoksa kimlige baglanamaz -> sabit maske (NOT NULL, varchar(120)).
UPDATE `audit_logs`
   SET `actor_email` = '[gizlendi]'
 WHERE `actor_id` IS NULL
   AND `actor_email` LIKE '%@%';

-- 5) Denetim outbox olaylari (JSON AuditLoggedEvent: actorId/action/targetType/targetId/details/system).
--    E-posta yalniz 'details' metninde bulunur; maske tirnak/ters bolu icermedigi icin JSON gecerli kalir.
--    Bekleyen AUDIT_LOG satirlari da maskelenir: aksi halde relay e-postayi yeniden audit_logs'a yazardi.
UPDATE `outbox_events`
   SET `payload` = REGEXP_REPLACE(`payload`,
         '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}',
         '[e-posta gizlendi]')
 WHERE `event_type` = 'AUDIT_LOG'
   AND `payload` REGEXP '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}';
