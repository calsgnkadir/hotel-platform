# Canlı Deploy — Tek Sunucu (docker compose + Caddy)

Tüm stack (frontend + backend + MySQL) tek bir Linux sunucuda, `docker compose`
ile. Caddy önde durup otomatik HTTPS verir ve her şeyi tek origin'den servis eder.

```
                    İnternet
                       │  443 (HTTPS, otomatik sertifika)
                　  ┌──▼───┐
                    │ Caddy │  /api,/ws,/actuator → backend
                    └──┬───┘  gerisi → frontend
          ┌────────────┼────────────┐   (hepsi ic agda, disari kapali)
     ┌────▼────┐  ┌────▼─────┐  ┌───▼────┐
     │ frontend│  │ backend  │  │ mysql  │
     │ nginx   │  │ :8080    │  │ (volume)│
     └─────────┘  └──────────┘  └────────┘
```

Neden bu mimari: `docker-compose` zaten doğrulanmış çalışıyor; onu yeniden
kullanıyoruz. Tek origin → CORS yok, mixed-content yok. Sonuç, mülakatta en güçlü
anlatı: *"containerized full-stack'i CI ile kendi sunucumda deploy ettim."*

---

## 0. Öğrenci = bedava sunucu

Kredi kartı gerektirmeyen / öğrenci kredili yollar:

| Yol | Kredi | Not |
| :-- | :-- | :-- |
| **GitHub Student Pack → DigitalOcean** | genelde $200 / 1 yıl | En temiz. `.edu.tr` ile başvur. Bir de ücretsiz domain (Namecheap `.me`) çıkar. |
| **Azure for Students** | ~$100, kart istemez | VM (B1s/B2s) aç, aynı adımlar. |
| Hetzner / herhangi VPS | ~€4/ay | Öğrenci değilsen en ucuz always-on. |

Sunucu: **Ubuntu 22.04+, en az 2 GB RAM** (Spring Boot + MySQL + build için 1 GB
sıkışır; 2 GB rahat). 1 vCPU yeterli.

> **Bu adımlar sana ait:** hesap açma, `.edu.tr` doğrulama, sunucu oluşturma,
> DNS ayarı. Asistan bunları yapamaz (hesap/kimlik). Aşağısı senin çalıştıracağın
> komutlar; config repoda hazır.

---

## 1. Domain'i sunucuya yönlendir

Sunucunun public IP'sini al. Domain sağlayıcında bir **A kaydı**:

```
ajanshotel.example.com   →   <SUNUCU_IP>
```

DNS yayılmadan Caddy sertifika alamaz. `ping ajanshotel.example.com` IP'yi
gösteriyorsa hazırsın.

> Henüz domain yoksa §7'deki **HTTP-only hızlı test** ile IP üzerinden deneyebilirsin.

---

## 2. Sunucuyu hazırla

SSH ile bağlan, Docker'ı kur:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # sonra bir kez çıkış-giriş yap
```

Güvenlik duvarı — sadece 80/443 (ve SSH) açık olsun; DB portu zaten dışarı kapalı:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

---

## 3. Repoyu çek, secret'ları doldur

```bash
git clone https://github.com/calsgnkadir/hotel-platform.git
cd hotel-platform
cp deploy/prod/.env.prod.example deploy/prod/.env.prod
nano deploy/prod/.env.prod
```

En az şunları doldur (`.env.prod` repoya girmez — `.gitignore`'da):

```bash
DOMAIN=ajanshotel.example.com
PUBLIC_URL=https://ajanshotel.example.com
DB_PASSWORD=<güçlü rastgele parola>
JWT_SECRET=<openssl rand -base64 48 çıktısı>
```

`openssl rand -base64 48` sunucuda çalışır; çıktıyı yapıştır.

---

## 4. Ayağa kaldır

Repo kökünden:

```bash
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml up -d --build
```

İlk build birkaç dakika (Maven + Vite). Sonra logları izle:

```bash
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml logs -f backend
```

Görmen gerekenler:

```
Successfully applied 10 migrations
[DEMO-SEED] ✓ 10 aday, 6 işletme, 15 ilan ...
Started HotelStudentPlatformApplication
```

Caddy ilk açılışta Let's Encrypt sertifikasını alır (`docker compose ... logs caddy`
içinde "certificate obtained" görünür).

---

## 5. Doğrula

```bash
curl https://ajanshotel.example.com/actuator/health      # {"status":"UP"}
curl https://ajanshotel.example.com/api/listings -o /dev/null -w "%{http_code}\n"  # 200
```

Tarayıcıda `https://ajanshotel.example.com` → landing açılır, `demo-isletme1@test.com`
/ `Demo1234!` ile giriş yapılır, ilanlar gelir, mesajlaşma (WebSocket) çalışır.

---

## 6. Health-check'i geri aç ve README/CV'yi güncelle

Canlıyı **doğruladıktan sonra**:

1. GitHub → Settings → Secrets → Actions → `BACKEND_URL` = `https://ajanshotel.example.com`
2. `.github/workflows/daily-health-check.yml` içindeki yorumlu `schedule` bloğunu aç.
3. Actions → Health Check → Run workflow ile elle bir kez çalıştır, `status.md` yeşil mi bak.
4. README rozetini ve CV'ni gerçek "Canlı Demo" olarak güncelle.

> Sıra önemli: **önce canlıyı doğrula, sonra "Live" de.** Ölü link, link
> olmamasından kötü.

---

## 7. HTTP-only hızlı test (domain yoksa)

Sadece IP ile denemek için `.env.prod`:

```bash
DOMAIN=:80
PUBLIC_URL=http://<SUNUCU_IP>
COOKIE_SECURE=false
```

`docker compose ... up -d --build` → `http://<SUNUCU_IP>` açılır. Caddy sertifika
denemez. Bu geçici; kalıcı demo için domain + HTTPS'e geç (tarayıcılar HTTP'yi
"güvensiz" işaretler).

---

## Günlük işlem

```bash
# guncelle
git pull
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml up -d --build

# durdur (veri volume'de kalir)
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml down

# TAMAMEN sifirla (DB dahil — demo veriyi yeniden kurar)
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml down -v
```

## Sorun giderme

| Belirti | Çözüm |
| :-- | :-- |
| Caddy sertifika alamıyor | DNS A kaydı sunucu IP'sine mi bakıyor? 80/443 açık mı? `docker compose ... logs caddy` |
| Giriş 401 ama şifre doğru | `COOKIE_SECURE=true` ama site HTTP mi? HTTPS'e geç ya da test için `false`. |
| WebSocket bağlanmıyor | `PUBLIC_URL` frontend build'ine gömülü — değiştirdiysen `--build` ile yeniden kur. |
| Build OOM (`Killed`) | Sunucu <2 GB. RAM artır ya da imajı güçlü makinede build edip push et. |
| `checksum mismatch V4` | Bu repoda düzeltildi; güncel `main`'de olduğundan emin ol. Detay: [README](../README.md#veritabanı-migrationları) |
