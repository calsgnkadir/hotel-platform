# Fly.io Deploy Rehberi — AjansHotel

Backend (Spring Boot) + MySQL Fly.io'da, frontend Vercel'de kalır.

```
┌──────────────────────┐        HTTPS         ┌─────────────────────────┐
│  Vercel              │ ───────────────────► │  Fly: ajanshotel-api    │
│  hotel-web (React)   │ ◄─────────────────── │  Spring Boot :8080      │
└──────────────────────┘   WSS (/ws-native)   └───────────┬─────────────┘
                                                          │ 6PN özel ağ
                                                          │ (public IP yok)
                                              ┌───────────▼─────────────┐
                                              │  Fly: ajanshotel-mysql  │
                                              │  MySQL 8 + volume       │
                                              └─────────────────────────┘
```

---

## Önce oku: maliyet

**Fly.io'nun ücretsiz kullanımı zamanla değişti.** Kayıt sırasında kredi kartı
isteniyor ve "free allowance" politikası dönem dönem güncelleniyor. Bu rehber
iki adet `shared-cpu-1x / 512MB` makine + 1GB volume varsayıyor; bu, Fly'ın
küçük kullanım aralığına denk gelir ama **ücretsiz kalacağının garantisi yoktur.**

Deploy'a başlamadan <https://fly.io/docs/about/pricing/> adresinden güncel
durumu kontrol et. Aylık ücret çıkacaksa alternatifler:

- Backend'i uyutmayı kabul et: `auto_stop_machines = true`, `min_machines_running = 0`
  (ilk istek ~20-30 sn bekler — demo için kötü görünür)
- Canlı linki bırak, README'ye Docker + ekran görüntüsü/video koy

---

## 0. Ön koşullar

| Gereken | Not |
|---|---|
| Fly hesabı | <https://fly.io/app/sign-up> — **hesabı sen açacaksın** |
| `flyctl` | `iwr https://fly.io/install.ps1 -useb \| iex` (Windows) |
| Cloudinary URL | Görsel yükleme çalışsın diye. Yoksa avatar/logo yükleme kırılır. |
| Resend API key | E-posta doğrulama/şifre sıfırlama için. Yoksa o akışlar sessizce başarısız. |
| Google OAuth client | "Google ile giriş" için. Boş bırakılırsa buton çalışmaz, gerisi çalışır. |

> Bu adımlarda parola ve API anahtarı girilir. Bunları **sen** gireceksin —
> asistan hesap açamaz, kimlik bilgisi giremez.

---

## 1. Giriş yap

```bash
fly auth login
```

---

## 2. MySQL uygulamasını oluştur

```bash
fly apps create ajanshotel-mysql --org personal
```

Kalıcı disk (makine yeniden yaratılınca veri gitmesin):

```bash
fly volumes create mysql_data --app ajanshotel-mysql --region ams --size 1
```

Kök parolayı ata — **güçlü ve rastgele bir parola üret, aşağıdakini olduğu gibi kullanma**:

```bash
fly secrets set MYSQL_ROOT_PASSWORD='BURAYA-GUCLU-PAROLA' --app ajanshotel-mysql
```

Deploy et:

```bash
fly deploy -c deploy/fly/mysql.fly.toml --app ajanshotel-mysql
```

Ayağa kalktığını doğrula:

```bash
fly logs --app ajanshotel-mysql
```

`ready for connections` satırını görmelisin.

> **Public IP yok.** `mysql.fly.toml` içinde bilerek `[http_service]` /
> `[[services]]` bloğu yok — veritabanı yalnızca Fly'ın özel ağından
> (`ajanshotel-mysql.internal`) erişilebilir. Dışarı açma.

---

## 3. Backend uygulamasını oluştur

```bash
fly apps create ajanshotel-api --org personal
```

### Secret'ları ata

```bash
fly secrets set --app ajanshotel-api \
  DB_PASSWORD='2.-ADIMDAKI-AYNI-PAROLA' \
  JWT_SECRET="$(openssl rand -base64 48)" \
  APP_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  CLOUDINARY_URL='cloudinary://KEY:SECRET@CLOUD_NAME' \
  RESEND_API_KEY='re_...' \
  GOOGLE_CLIENT_ID='...apps.googleusercontent.com' \
  GOOGLE_CLIENT_SECRET='...'
```

`openssl` yoksa PowerShell'de:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

> Secret'lar `fly.toml`'a **yazılmaz** — repoda secret tutmuyoruz. Yalnızca
> hassas olmayan ayarlar `[env]` bloğunda duruyor.

### Deploy

```bash
fly deploy -c deploy/fly/backend.fly.toml --app ajanshotel-api
```

İlk açılışta Flyway 10 migration'ı uygular ve `demo` profili örnek veriyi
yükler (idempotent). Logları izle:

```bash
fly logs --app ajanshotel-api
```

Görmen gerekenler:

```
Successfully applied 10 migrations
DEMO-SEED ...
Started HotelStudentPlatformApplication
```

### Doğrula

```bash
curl https://ajanshotel-api.fly.dev/actuator/health
curl https://ajanshotel-api.fly.dev/v3/api-docs -o NUL -w "%{http_code}\n"
```

`{"status":"UP"}` ve `200` bekleniyor.

---

## 4. Vercel'i yeni API'ye bağla

Vercel → Project → Settings → Environment Variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://ajanshotel-api.fly.dev` |

Sonra **Redeploy** (env değişikliği otomatik build tetiklemez).

Frontend adresi değişirse backend'in CORS'unu da güncelle:

```bash
fly secrets set APP_CORS_ALLOWED_ORIGINS='https://YENI-ADRES' --app ajanshotel-api
```

---

## 5. Google OAuth redirect URI

Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs:

```
https://ajanshotel-api.fly.dev/login/oauth2/code/google
```

---

## 6. Health check'i geri aç

Backend gerçekten canlıyken:

1. GitHub → Settings → Secrets → Actions → `BACKEND_URL` = `https://ajanshotel-api.fly.dev`
2. `.github/workflows/daily-health-check.yml` içindeki yorumlu `schedule` bloğunu geri aç:

```yaml
on:
  schedule:
    - cron: '7 6 * * *'   # 09:07 Istanbul
  workflow_dispatch: {}
```

3. Actions → Health Check → **Run workflow** ile elle bir kez çalıştır, `status.md`
   yeşil rapor yazıyor mu bak.

> Sıralama önemli: **önce canlıyı doğrula, sonra cron'u aç.** Ters yaparsan
> repo yine her sabah ❌ raporu commit'ler.

---

## 7. README'yi güncelle

Backend doğrulandıktan **sonra**:

- `README.md` üstündeki `Arayüz Önizleme` rozetini gerçek "Canlı Demo" rozetine çevir
- "Arayüz Önizleme" bölümündeki *"backend şu an kapalı"* notunu kaldır

Bunu erken yapma — çalıştığını görmeden "Canlı" etiketi koymak, linkin hiç
olmamasından kötüdür.

---

## Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| `Communications link failure` | MySQL makinesi durmuş. `fly status --app ajanshotel-mysql`, gerekirse `fly machine start`. |
| `Unknown column 'version'` | Eski V4 migration'ı. Bu repoda düzeltildi — güncel `main`'de olduğundan emin ol. |
| `Validate failed: migration checksum mismatch` | V4 idempotent hale getirilirken checksum'ı değişti. Bir kez `fly ssh console` → repair, ya da yeni bir DB ile başla. Detay: [README → Veritabanı migration'ları](../README.md#veritabanı-migrationları) |
| CORS hatası | `APP_CORS_ALLOWED_ORIGINS` Vercel adresiyle birebir eşleşmeli (sonda `/` olmayacak). |
| Login 401 ama şifre doğru | `COOKIE_SAMESITE=None` + `COOKIE_SECURE=true` gerekli (cross-origin). `backend.fly.toml`'da ayarlı. |
| OOM / makine restart döngüsü | `fly logs`'ta `Killed`. JVM heap'i kıs: `fly secrets set JAVA_TOOL_OPTIONS='-XX:MaxRAMPercentage=60 -XX:+UseSerialGC'` |
