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

## 0. Sunucu ve öğrenci teklifleri

Fiyatlar ve kampanyalar değişir; aşağıdaki bilgiler **28 Ekim 2026** tarihinde
sağlayıcıların kendi sayfalarından kontrol edildi. Bir servis oluşturmadan önce
seçilen bölge, vergi, IP, disk, yedek, taahhüt ve yenileme ücretlerini hesapta
kontrol et. Öğrenci faydasının hesapta etkin olduğunu varsayma.

| Yol | Kontrol edilen bilgiler | Sınır / kalan kontrol |
| :-- | :-- | :-- |
| [Azure for Students](https://learn.microsoft.com/azure/education-hub/about-azure-for-students) | Uygun öğrencilere 12 ay içinde kullanılacak 100 USD kredi; kayıt için kredi kartı gerekmez. | 18+ tam zamanlı yükseköğretim ve kurum e-postasıyla doğrulama gerekir; aktif öğrenciyken yıllık yenileme mümkündür. [Microsoft FAQ](https://learn.microsoft.com/en-us/azure/education-hub/faq) kullanım amacını eğitim/öğretim, ticari olmayan araştırma ve bu amaçlarla geliştirme/test/demoyla sınırlar. Ticari kafelerin kullanacağı üretim için uygun olduğunu varsayma. Kredi biter veya 12 ay dolarsa abonelik durabilir. |
| [GitHub Student Developer Pack](https://education.github.com/pack) | Namecheap için bir yıllık `.me` alan adı kaydı ve Azure teklifi listeleniyor. | `kadrom.me` mevcut kayıt olduğundan yeni domain satın almadan registrar, yenileme tarihi ve teklifin hesaba uygulanabilirliği kontrol edilmeli. Mevcut listede DigitalOcean teklifi doğrulanamadı; eski `$200 / 1 yıl` ve kart gerekmeme iddiasına güvenme. |
| [DigitalOcean Basic](https://www.digitalocean.com/pricing/droplets) | Aylık üst sınır: 1 GiB RAM için 6 USD, 2 GiB için 12 USD. | 1 GiB bu uygulamanın tüm servisleri ve imaj derlemesi için risklidir; 2 GiB kullanıcı bütçesini aşar. Vergi ve yedek maliyeti ayrıca kontrol edilmeli. Türkiye lokasyonu gereksinimini karşılayıp karşılamadığı teyit edilmeli. |
| [Hetzner CX23](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) | 4 GB RAM; Almanya/Finlandiya için 6,49 USD/ay, IPv4 hariç ve vergi hariç. | [Primary IPv4](https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing/) 0,60 USD/ay ek; toplam 7,09 USD/ay + uygulanacak vergi, yedek hariç. 6 USD sınırını aşar. |

Türkiye'deki alternatiflerde ilan edilen fiyatın aylık yenileme mi, uzun dönem
peşin karşılığı mı olduğu; KDV, public IPv4, Linux root/Docker desteği, veri merkezi
ve sunucu dışı yedeğin ücreti satın almadan doğrulanmalıdır. Sağlayıcı kalitesi,
destek ve gerçek kapasitesi bu listeyle doğrulanmış sayılmaz.

> **Sunucu Türkiye'de olacak (karar).** Kullanıcı verisi (aday profili, telefon,
> vardiya/giriş kayıtları) KVKK kapsamında; veritabanı ve yedekler Türkiye'deki bir
> veri merkezinde durur, yurt dışına aktarım azalır. Türkiye lokasyonu sunan bir VPS
> sağlayıcısı seç (veri merkezi şehrini sözleşmede/panelde doğrula). Dikkat: Cloudinary
> (görsel), Resend (e-posta), Google girişi ve OpenStreetMap/Nominatim (adres arama)
> yurt dışı hizmetlerdir — bunlara giden veri için Aydınlatma Metni'nde yurt dışı
> aktarım bilgisi gerekir (hukuki değerlendirme: açık konu).

Sunucu: **Ubuntu 22.04+, en az 2 GB RAM ile başlama hedefi**. Spring Boot, MySQL,
frontend ve Caddy birlikte çalışır; uygulama 2 GB üzerinde yük ve derleme testi
geçirmediği için bu yeterlilik garantisi değildir. Özellikle Maven ve Vite
derlemesi aynı sunucuda bellek tüketimini artırabilir; önceden oluşturulmuş imaj,
swap ve kapasite ölçümü değerlendirilmelidir. Daha fazla bellek güvenli pay sağlar.

> Hesap/kimlik doğrulama, ödeme ve canlı DNS değişiklikleri kullanıcıyla birlikte
> yapılmalıdır. Aşağıdaki komutlar ve config hazırlık içindir; önce seçilen
> sağlayıcı ve maliyet doğrulanmalıdır.

---

## 1. Domain'i sunucuya yönlendir

Sunucunun public IP'sini al. Domain sağlayıcında bir **A kaydı**:

```
kadrom.me   →   <SUNUCU_IP>
```

DNS kaydının sunucu IP'sine yönlendiğini doğrula; DNS sonucu tek başına HTTPS'in
hazır olduğunu göstermez. Caddy'nin sertifika alabilmesi için 80 ve 443 numaralı
portların dışarıdan erişilebilir olması ve sertifikanın başarıyla oluşturulması
da kontrol edilmelidir.

> Üretim profili HTTPS gerektirir; alan adı henüz yönlenmiyorsa §7'deki açıklamaya bak.

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

### Canlıya almadan önce kısa kontrol listesi

| | Adım | Komut / not |
| :-- | :-- | :-- |
| ☐ | **Güvenlik duvarı** yalnız 22/80/443 | yukarıdaki `ufw`; `sudo ufw status verbose` |
| ☐ | **SSH yalnız anahtarla** | `ssh-copy-id` ile anahtarını ekle → `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no` → `sudo systemctl restart ssh` (önce ikinci oturumda anahtarla girişi dene) |
| ☐ | **Otomatik güvenlik güncellemeleri** | `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades` |
| ☐ | **Saat (NTP) ve saat dilimi** | `timedatectl` → `System clock synchronized: yes`; değilse `sudo timedatectl set-ntp true`. Uygulama Europe/Istanbul kullanır; vardiya/QR girişi doğru saate bağlı. |
| ☐ | **Gece yedeği (cron)** | aşağıda "Yedekleme" — `backup.sh` her gece |
| ☐ | **Sunucu dışı kopya** | yedeği başka bir yere (ikinci sunucu / nesne depolama) kopyala; disk giderse yedek de gider |
| ☐ | **Geri yükleme provası** | ilk kurulumda bir kez ve ayda bir: yedeği ayrı bir test veritabanına `restore.sh` ile yükle, giriş yapılabildiğini gör |
| ☐ | **`.env.prod` izni** | `chmod 600 deploy/prod/.env.prod`; repoya girmez |
| ☐ | **İlk yönetici** | §5.1 |

---

## 3. Repoyu çek, secret'ları doldur

```bash
git clone https://github.com/calsgnkadir/hotel-platform.git
cd hotel-platform
cp deploy/prod/.env.prod.example deploy/prod/.env.prod
nano deploy/prod/.env.prod
```

Şunları doldur (`.env.prod` repoya girmez — `.gitignore`'da). Biri eksikse
`docker compose` başlamaz ya da backend açılışta durur (`ProductionSafetyConfiguration`):

```bash
DOMAIN=kadrom.me
PUBLIC_URL=https://kadrom.me                  # https; localhost/http reddedilir
MYSQL_ROOT_PASSWORD=<ayrı güçlü yönetici parolası>
DB_PASSWORD=<kadrom_app için farklı güçlü parola>
APP_ENCRYPTION_KEY=<openssl rand -base64 32 çıktısı>
JWT_SECRET=<openssl rand -base64 48 çıktısı>
CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD  # 'test' içeren değer reddedilir
RESEND_API_KEY=re_...
RESEND_FROM=bildirim@kadrom.me                # doğrulanmış alan adı; @resend.dev olmaz
VAPID_PUBLIC_KEY=...                          # npx web-push generate-vapid-keys (bir kez)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:destek@kadrom.me
```

İsteğe bağlı: `GOOGLE_CLIENT_ID/SECRET` (Google girişi), `GEO_CONTACT_EMAIL`
(adres arama; yoksa `RESEND_FROM`), `SMS_ENABLED` + `NETGSM_*`, `IYZICO_*` (yoksa
ödeme kapalı; ücretsiz planın "aynı anda 5 aktif ilan" sınırı yine geçerli).
Tam liste ve açıklamalar: `deploy/prod/.env.prod.example`.

`openssl rand -base64 48` sunucuda çalışır; çıktıyı yapıştır. Windows'ta
PowerShell: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`
(`Get-Random` kullanma — kriptografik değil).

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
Successfully applied ... migrations
Started HotelStudentPlatformApplication
```

Caddy ilk açılışta Let's Encrypt sertifikasını alır (`docker compose ... logs caddy`
içinde "certificate obtained" görünür).

---

## 5. Doğrula

```bash
curl https://kadrom.me/actuator/health      # {"status":"UP"}
curl https://kadrom.me/api/listings -o /dev/null -w "%{http_code}\n"  # 200
```

Tarayıcıda `https://kadrom.me` açılır. Kendi hesabınla kayıt, giriş ve mesajlaşmayı doğrula. Üretimde demo hesap oluşturulmaz.

### 5.1 İlk yönetici (tek seferlik)

Kayıt formu ADMIN rolü vermez (bilerek). İlk yöneticiyi sunucuda, veritabanında bir kez yükselt:

1. Sitede kendi e-postanla **normal kayıt ol** ve gelen bağlantıyla **e-postanı doğrula**
   (doğrulanmamış adresi yükseltme: adres sana ait olmayabilir).
2. Sunucuda (repo kökünden) e-postayı kendi adresinle değiştirerek bir SQL dosyası yaz
   ve etkileşimsiz çalıştır (parola konteynerin kendi ortam değişkeninden okunur):

```bash
cat > /tmp/ilk-admin.sql <<'SQL'
UPDATE users SET role = 'ADMIN'
 WHERE email = 'sen@ornek.com' AND email_verified_at IS NOT NULL;
SELECT id, email, role FROM users WHERE role = 'ADMIN';
SQL
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml \
  exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" hotel_platform' < /tmp/ilk-admin.sql
rm /tmp/ilk-admin.sql
```

   Çıktıda kendi e-postan `ADMIN` olarak görünmeli; görünmüyorsa e-posta doğrulanmamıştır.

3. Çıkış yapıp tekrar gir (arayüz rolü oturum açılırken alır; sunucu her istekte rolü veritabanından okur).

Neden env ile otomatik yükseltme (`ADMIN_BOOTSTRAP_EMAIL`) yok: o e-postayı senden önce
biri kaydederse yönetici olurdu; tek seferlik ve doğrulanmış adrese bağlı SQL adımı
hem daha basit hem saldırı yüzeyi bırakmaz. İkinci yöneticiyi de aynı yolla ekle.

---

## 6. Health-check'i geri aç ve README/CV'yi güncelle

Canlıyı **doğruladıktan sonra**:

1. GitHub → Settings → Secrets → Actions → `BACKEND_URL` = `https://kadrom.me`
2. `.github/workflows/daily-health-check.yml` içindeki yorumlu `schedule` bloğunu aç.
3. Actions → Health Check → Run workflow ile elle bir kez çalıştır, `status.md` yeşil mi bak.
4. README rozetini ve CV'ni gerçek "Canlı Demo" olarak güncelle.

> Sıra önemli: **önce canlıyı doğrula, sonra "Live" de.** Ölü link, link
> olmamasından kötü.

---

## 7. HTTP-only hızlı test (artık yok)

Prod profili `COOKIE_SECURE=false`, `http://` ya da `localhost` adresle **açılmaz**
(oturum çerezi düz HTTP'de sızar). Alan adı + HTTPS olmadan prod kurma; yalnız
denemek için repo kökündeki yerel `docker-compose.yml`'i (dev/demo) kullan.

---

## Günlük işlem

```bash
# guncelle
git pull
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml up -d --build

# durdur (veri volume'de kalir)
docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml down

```

## Yedekleme (backup)

DB `mysql_data` volume'unde tutulur. Sunucu/disk olurse veri gider — duzenli **mysqldump** al.
Bu repoda hazir script'ler: `deploy/prod/backup.sh` (yedek + rotasyon) ve `deploy/prod/restore.sh` (geri yukle).

```bash
# tek seferlik yedek (deploy/prod icinden)
cd deploy/prod && chmod +x backup.sh restore.sh
./backup.sh                      # -> backups/hotel_platform-YYYYMMDD-HHMMSS.sql.gz

# her gece 03:30 otomatik (crontab -e)
30 3 * * * cd /opt/kadrom/deploy/prod && ./backup.sh >> backups/backup.log 2>&1

# geri yukleme (DIKKAT: ustune yazar)
./restore.sh backups/hotel_platform-YYYYMMDD-HHMMSS.sql.gz
```

- `backup.sh` son **14** yedegi tutar (`KEEP` env ile degistir), `--single-transaction` ile
  kilitsiz/tutarli dump alir, bos/bozuk dump'i yakalayip hata doner (cron alarmi icin).
- **Off-site kopya sart:** yedekler sunucuda; diski kaybedersen yedek de gider. En az bir
  kopyayi baska yere al (rclone -> nesne depolama, ya da `scp`/`rsync` ile baska sunucu).
  Ornek (yedekten sonra, 04:00): `0 4 * * * rsync -a /opt/kadrom/deploy/prod/backups/ yedek@ikinci-sunucu:/yedek/kadrom/`
  Kopya da Turkiye'de olsun (KVKK); dump sifreli alanlari sifreli tasir, `APP_ENCRYPTION_KEY`'i
  yedekle AYNI yerde tutma.
- Ayda bir **geri yukleme provasi** yap — test edilmemis yedek, yedek degildir.

## Mevcut veritabanından geçiş

[Üretim izolasyonu ve mevcut volume geçişi](PRODUCTION_ISOLATION.md) adımlarını uygula. Yeni MySQL ortam değişkenleri mevcut volume üzerinde kullanıcı veya parola değiştirmez.

## Sorun giderme

| Belirti | Çözüm |
| :-- | :-- |
| Caddy sertifika alamıyor | DNS A kaydı sunucu IP'sine mi bakıyor? 80/443 açık mı? `docker compose ... logs caddy` |
| Giriş 401 ama şifre doğru | Site HTTP mi? Prod yalnız HTTPS'te çalışır (`COOKIE_SECURE=true` zorunlu). |
| Backend `PROD-SAFETY: ...` ile kapanıyor | Mesajdaki değişkeni `.env.prod`'da düzelt (ör. `RESEND_FROM`, `VAPID_*`, `CLOUDINARY_URL`, https `PUBLIC_URL`). |
| WebSocket bağlanmıyor | `PUBLIC_URL` frontend build'ine gömülü — değiştirdiysen `--build` ile yeniden kur. |
| Build OOM (`Killed`) | Sunucu <2 GB. RAM artır ya da imajı güçlü makinede build edip push et. |
| `checksum mismatch V4` | Bu repoda düzeltildi; güncel `main`'de olduğundan emin ol. Detay: [README](../README.md#veritabanı-migrationları) |
