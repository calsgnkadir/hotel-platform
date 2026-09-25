# Canlı Deploy — Render + Aiven (tamamen bedava, kredi kartı yok)

Kart istemeyen yol. Frontend ve backend Render'da, MySQL Aiven'da. Yapılandırma
repoda hazır: [`render.yaml`](../render.yaml) (Render Blueprint).

```
   kadrom.me ──────────► kadrom-web  (Render static site — bedava, uyumaz)
                              │ tarayıcı → https://api.kadrom.me
   api.kadrom.me ──────► kadrom-api  (Render free web service, Docker)
                              │ SSL
                         Aiven MySQL (free: 1 GB RAM, 1 GB disk)
```

`kadrom.me` ve `api.kadrom.me` aynı site sayılır → refresh çerezi SameSite=Lax
ile her tarayıcıda (Safari dahil) çalışır.

## Bilinmesi gereken kısıtlar

| Kısıt | Etki | Çözüm |
| :-- | :-- | :-- |
| Free web service **0.1 CPU** | Açılış ~6 dk (yerelde `--cpus=0.1 --memory=512m` ile ölçüldü). Render başlatma için 15 dk tanır; ayarsız 17,5 dk sürüyordu → `render.yaml`'daki lazy-init + C1 JIT şart. | Render her deploy'u zero-downtime yapar: yeni sürüm açılana kadar eskisi yayında kalır. |
| 15 dk istek gelmezse **uyur** | Sonraki ziyaretçi ~6 dk bekler | UptimeRobot 5 dk'da bir ping (adım 5). 7/24 açık ≈ 744 saat/ay, free kotası 750 saat. |
| Aiven free **1 GB disk**, uzun süre kullanılmazsa kapanır | Demo verisi küçük; ping DB'ye de dokunur (Hikari keepalive) | Kapanırsa Aiven konsolundan "Power on". |
| Aiven `sql_require_primary_key=ON` | V1/V9'daki koleksiyon tabloları PK'siz | `application-prod.yml` → Flyway bağlantısında oturum bazında kapatılır (Aiven'ın önerdiği yol). |

> **Bu adımlar sana ait:** hesap açma, şifreler, DNS. Asistan hesap/kimlik
> işlemi yapamaz. Aşağıdaki her şey tıklama; komut yok.

---

## 1. Aiven — MySQL (5 dk)

1. <https://console.aiven.io/signup> → GitHub ile kaydol (kart istemez).
2. **Create service → MySQL → Free plan**. Bölge: Avrupa'da ne varsa
   (Frankfurt/Amsterdam yakın). Ad: `kadrom-db`.
3. Servis **Running** olunca **Overview → Connection information**'dan şunları
   bir kenara not et: **Host**, **Port**, **User** (`avnadmin`), **Password**.
   Veritabanı adı `defaultdb` (render.yaml'da hazır).

## 2. Render — Blueprint (5 dk + ilk build ~10 dk)

1. <https://dashboard.render.com> → **GitHub ile kaydol** (kart istemez).
2. **New → Blueprint** → bu repoyu seç → Render `render.yaml`'ı okur, iki servisi
   (`kadrom-api`, `kadrom-web`) listeler.
3. Sorulan 4 değeri Aiven'dan gir: `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
   `DB_PASSWORD`. `JWT_SECRET` ve `APP_ENCRYPTION_KEY`'i Render kendisi üretir.
4. **Apply**. `kadrom-web` birkaç dakikada, `kadrom-api` build + ~6 dk açılışla
   hazır olur. Logda şunları gör:
   - `Successfully applied ... now at version v15`
   - `[JWT-GUARD] prod profili + guclu JWT_SECRET — OK`
   - `Started HotelStudentPlatformApplication`
   - `[DEMO-SEED] ✓ 10 aday, 6 işletme, 15 ilan ...`

## 3. Domain — Namecheap DNS

Render'da her serviste **Settings → Custom Domains** altında domain zaten
ekli (render.yaml). Render'ın o ekranda gösterdiği hedefleri kullan.
Namecheap → **Domain List → kadrom.me → Manage → Advanced DNS**:

1. nc.me'nin GitHub Pages kurulumundan kalan kayıtları **sil**
   (`185.199.x.x` A kayıtları, `www → <kullanıcı>.github.io` CNAME, varsa AAAA).
2. Ekle:

| Tip | Host | Değer |
| :-- | :-- | :-- |
| ALIAS | `@` | `kadrom-web.onrender.com` |
| CNAME | `www` | `kadrom-web.onrender.com` |
| CNAME | `api` | `kadrom-api.onrender.com` |

3. Render ekranında domainler **Verified** olunca TLS sertifikası otomatik gelir
   (birkaç dakika – birkaç saat).

## 4. Kontrol

```bash
curl https://api.kadrom.me/actuator/health/liveness
```

→ `{"status":"UP"}`. Tarayıcıda <https://kadrom.me> → landing açılır;
`demo-isletme1@test.com` / `demo-aday1@test.com` hesaplarıyla (şifre demo
seed logunda) giriş yapılabilir.

## 5. Uyumasın — UptimeRobot (2 dk)

1. <https://uptimerobot.com> → ücretsiz hesap.
2. **New monitor → HTTP(s)** → URL: `https://api.kadrom.me/actuator/health/liveness`,
   aralık **5 dakika**.

Yan kazanç: herkese açık bir durum sayfası (uptime %) — CV'de link olarak
verilebilir.

## Güncelleme

`main`'e push → Render ilgili servisi otomatik yeniden build eder
(`buildFilter`: backend sadece `hotelapp/**`, frontend sadece `hotel-web/**`
değişince). Backend açılışı ~6 dk sürer; bu sürede eski sürüm yayında kalır.
