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

## Bu ortam bir CV vitrini

Render kurulumu **gerçek ürün değil, vitrindir**: backend `prod,showcase` ile çalışır.
`prod`'un bütün güvenlik kontrolleri açıktır (JWT/şifreleme anahtarı zorunlu, `root`
yasak, `ddl-auto=validate`, `prod`+`demo`/`dev`/`test` birleşimi yasak); `showcase`
yalnızca örnek veriyi ve demo hesapları yükler. Frontend `VITE_SHOWCASE=true` ile
üstte "demo vitrini, gerçek kişisel bilgi girmeyin" bandı gösterir.

Gerçek ürüne geçince: `SPRING_PROFILES_ACTIVE=prod` (showcase'siz), **ayrı ve temiz**
bir veritabanı, ayrı DB kullanıcısı ve gerçek Cloudinary/e-posta/ödeme anahtarları
([PRODUCTION_ISOLATION.md](PRODUCTION_ISOLATION.md)).

## Bilinmesi gereken kısıtlar

| Kısıt | Etki | Çözüm |
| :-- | :-- | :-- |
| Free web service **0.1 CPU** | Açılış ~6 dk (yerelde `--cpus=0.1 --memory=512m` ile ölçüldü). Render başlatma için 15 dk tanır; ayarsız 17,5 dk sürüyordu → `render.yaml`'daki lazy-init + C1 JIT şart. | Render her deploy'u zero-downtime yapar: yeni sürüm açılana kadar eskisi yayında kalır. |
| 15 dk istek gelmezse **uyur** | Sonraki ziyaretçi ~6 dk bekler | UptimeRobot 5 dk'da bir ping (adım 5). 7/24 açık ≈ 744 saat/ay, free kotası 750 saat. |
| Aiven free **1 GB disk**, uzun süre kullanılmazsa kapanır | Demo verisi küçük; ping DB'ye de dokunur (Hikari keepalive) | Kapanırsa Aiven konsolundan "Power on". |
| Aiven `sql_require_primary_key=ON` | V1/V9'daki koleksiyon tabloları PK'siz | `render.yaml` → `SPRING_FLYWAY_INIT_SQLS=SET SESSION sql_require_primary_key = 0` (yalnız Render/Aiven; diğer kurulumlara uygulanmaz). Bu oturum ayarı yetki ister: yerel MySQL benzetiminde yönetici kullanıcıyla doğrulandı; Aiven'ın `avnadmin` kullanıcısıyla ve kısıtlı ayrı kullanıcıyla henüz **denenmedi**. |

> **Bu adımlar sana ait:** hesap açma, şifreler, DNS. Asistan hesap/kimlik
> işlemi yapamaz. Aşağıdaki her şey tıklama; komut yok.

---

## 1. Aiven — MySQL (5 dk)

1. <https://console.aiven.io/signup> → GitHub ile kaydol (kart istemez).
2. **Create service → MySQL → Free plan**. Bölge: Avrupa'da ne varsa
   (Frankfurt/Amsterdam yakın). Ad: `kadrom-db`.
3. Servis **Running** olunca **Overview → Connection information**'dan şunları
   bir kenara not et: **Host**, **Port**, **User** (`avnadmin`), **Password**. Vitrinde `avnadmin` kullanılabilir (izole demo veritabanı; `root` olmadığı için prod kontrolünden geçer). Gerçek ürüne geçerken ayrı, yalnızca hedef veritabanına yetkili kullanıcı oluştur ve migration yetkisini yöneticiyle doğrula.
   Veritabanı adı `defaultdb` (render.yaml'da hazır).

## 2. Render — Blueprint (5 dk + ilk build ~10 dk)

1. <https://dashboard.render.com> → **GitHub ile kaydol** (kart istemez).
2. **New → Blueprint** → bu repoyu seç → Render `render.yaml`'ı okur, iki servisi
   (`kadrom-api`, `kadrom-web`) listeler.
3. Sorulan değerleri gir:
   - Aiven'dan 4 değer: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`.
   - Bildirim anahtarları: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (aşağıdaki
     "Bildirim anahtarları" bölümü).
   `JWT_SECRET` ve `APP_ENCRYPTION_KEY`'i Render kendisi üretir.
4. **Apply**. `kadrom-web` birkaç dakikada, `kadrom-api` build + ~6 dk açılışla
   hazır olur. Logda şunları gör:
   - `Successfully applied ... now at version v19`
   - `[JWT-GUARD] prod profili + guclu JWT_SECRET — OK`
   - `Started HotelStudentPlatformApplication`
   - `[DEMO-SEED] ✓ 10 aday, 6 işletme, 15 ilan ...` (vitrin: `prod,showcase`)

### Bildirim anahtarları (VAPID)

Push bildirimleri bir anahtar çiftiyle imzalanır. Çift **bir kez** üretilir ve
hep aynı kalır; değişirse herkesin bildirim kaydı geçersiz olur.

1. Kendi bilgisayarında (Node yüklü) şunu çalıştır:

   ```bash
   node -e "const c=require('crypto');const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=k.publicKey.export({format:'jwk'});const s=k.privateKey.export({format:'jwk'});const b=x=>Buffer.from(x,'base64url');console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),b(p.x),b(p.y)]).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+s.d)"
   ```

2. Çıkan iki satırı Render → `kadrom-api` → **Environment**'a gir.
3. Özel anahtarı (`VAPID_PRIVATE_KEY`) kimseyle paylaşma, repoya veya sohbete
   yapıştırma; bir parola yöneticisinde sakla.

Vitrinde (`prod,showcase`) boş bırakılırsa uygulama açılır ama her yeniden
başlatmada abonelikler bozulur. Gerçek üründe (`prod`) boşsa sunucu **açılmaz**.

### E-posta (Resend)

Şifre sıfırlama, e-posta doğrulama, başvuru sonucu ve ekip listesi (Excel) e-postayla
gider. **Gerçek üründe zorunlu** — `RESEND_API_KEY` (`re_` ile başlar) ve kendi alan
adından bir `RESEND_FROM` yoksa sunucu açılmaz. Vitrinde bilerek kapalı (demo
hesapları gerçek olmayan adresler; mail atılırsa geri döner, alan adının itibarı düşer).

1. <https://resend.com> → kaydol (ücretsiz: günde 100, ayda 3.000 mail).
2. **Domains → Add Domain** → `kadrom.me`, bölge **Ireland (eu-west-1)**.
3. Resend 4 DNS kaydı gösterir. Namecheap → kadrom.me → **Advanced DNS** →
   **ADD NEW RECORD** ile **birebir** gir (kadrom.me'de 2026-10 itibarıyla girildi):

   | Type | Host | Value |
   |---|---|---|
   | TXT | `resend._domainkey` | `p=MIGfMA...` (DKIM — Resend'de değere tıklayıp kopyala) |
   | CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
   | CNAME | `send` | `send.forge.rmta.net` |
   | TXT | `_dmarc` | `v=DMARC1; p=none;` |

   - **Host** kutusuna sadece alt kısmı yaz (sonuna `.kadrom.me` ekleme).
   - Değerleri ekrandaki `[...]` kısaltmasından değil, tıklayıp kopyalayarak al.
   - DKIM değeri `p=` ile, DMARC değeri `v=DMARC1` ile başlar — karıştırma.
   - MX kaydı gerekmez (Resend gönderim için CNAME kullanıyor).
4. Resend'de **Verify DNS Records** → hepsi "Verified" olana kadar bekle
   (genelde dakikalar, en çok birkaç saat).
5. **API Keys → Create API Key** → izin: *Sending access*, alan adı: `kadrom.me`.
   Anahtar **bir kez** gösterilir; kopyala.
6. Gerçek ürünün `kadrom-api` → **Environment**:
   - `RESEND_API_KEY` = az önce kopyaladığın `re_...`
   - `RESEND_FROM` = `bildirim@kadrom.me` (doğrulanmış alan adından herhangi bir ad)
7. Kontrol: uygulamada "Şifremi unuttum" → kendi adresine mail gelmeli. Gelmezse
   admin paneli → **Outbox**'ta e-posta satırının son hatası yazar
   (ör. `403 ... domain is not verified`).

Anahtarı (`re_...`) repoya veya sohbete yapıştırma.

### Google ile giriş (isteğe bağlı)

Ayarlanmazsa **Google butonu otomatik gizlenir**, e-posta/şifre girişi normal çalışır
(kırık buton gösterilmez). Açmak için:

1. <https://console.cloud.google.com> → yeni proje: `Kadrom`.
2. **APIs & Services → OAuth consent screen** → *External* → uygulama adı `Kadrom`,
   destek e-postası, **Authorized domain**: `kadrom.me`; kapsamlar: `email`, `profile`.
   Sonra **Publish app** (yayınlanmazsa yalnızca eklediğin test kullanıcıları girebilir).
3. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - **Authorized JavaScript origins**: `https://kadrom.me`
   - **Authorized redirect URIs**: `https://api.kadrom.me/login/oauth2/code/google`
4. Çıkan **Client ID** (`...apps.googleusercontent.com`) ve **Client secret**'ı
   Render → `kadrom-api` → **Environment**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Yeniden başlatınca buton giriş/kayıt ekranlarında kendiliğinden görünür
   (`GET /api/auth/providers` → `{"google": true}`).

Client secret'ı repoya veya sohbete yapıştırma.

### Ödeme (iyzico, isteğe bağlı)

Kodda varsayılan iyzico anahtarı **yok**. `IYZICO_API_KEY` / `IYZICO_SECRET_KEY`
verilmezse ödeme kapalıdır: abonelik ekranında satın alma butonu çıkmaz, ilan kotası
uygulanmaz — işletmeler ücretsiz ve sınırsız ilan açar. Açılış için gerekmez.

- **Vitrin (`prod,showcase`)**: ödeme akışını göstermek istersen kendi iyzico
  *sandbox* hesabının anahtarlarını Environment'a gir. Ekranda test kartı yalnızca
  sandbox'ta görünür; gerçek para hareket etmez.
- **Gerçek ödeme (`prod`, vitrinsiz)**: önce kayıtlı şirket + onaylı iyzico üye işyeri
  hesabı gerekir. Sonra:
  - `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` → canlı anahtarlar
  - `IYZICO_BASE_URL` = `https://api.iyzipay.com`
  - `IYZICO_CALLBACK_URL` = `https://api.kadrom.me/api/billing/callback`

  Prod'da sandbox adresi/anahtarı, tek anahtar ya da `https` olmayan callback
  verilirse uygulama **açılmaz** (ProductionSafetyConfiguration) — sandbox'ta herkese
  açık test kartıyla bedava abonelik alınabilirdi.

Anahtarları repoya veya sohbete yapıştırma.

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
`demo-aday1@test.com` / `demo-isletme1@test.com` (şifre `Demo1234!`, sitedeki bantta da yazar) ile giriş yap. Gerçek ürüne geçişte demo hesapları olan veritabanında açılış durur; [geçiş rehberini](PRODUCTION_ISOLATION.md) uygula.

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
