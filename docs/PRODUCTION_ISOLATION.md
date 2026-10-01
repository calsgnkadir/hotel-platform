# Üretim ve demo ayrımı

VPS Compose ve Fly backend yalnızca `prod` kullanır. `prod` ile `dev`,
`demo` veya `test` birleştirilirse uygulama veritabanına bağlanmadan durur.

**İstisna — CV vitrini (Render):** `prod,showcase`. Prod kontrollerinin hepsi açık
kalır; `showcase` yalnızca demo verisini yükler ve demo hesap kontrolünü
(`ProductionDemoDataGuard`) kapatır. Vitrin veritabanı gerçek kullanıcıyla
paylaşılmaz; gerçek ürün ayrı, temiz veritabanıyla `prod` olarak açılır.
Üretim `root` kullanamaz ve Hibernate `ddl-auto=validate` olmak zorundadır.
Flyway şemayı yönetir; uygulama hesabının hedef şemada DDL yetkisine ihtiyacı vardır.

Demo için kökteki geliştirme Compose dosyasını ve ayrı veritabanı/volume kullan.
Üretim adresi, kimlik bilgileri veya volume'ünü demo ortamıyla paylaşma.
Eski seed hesapları (`demo-aday*@test.com`, `demo-isletme*@test.com`) bulunan
veritabanında üretim başlangıcı durur. Bu kontrol veri silmez; yeniden adlandırılmış
demo hesaplarını veya tüm örnek kayıtları tespit eden bir veri temizleyicisi değildir.

## Mevcut volume için geçiş

Önce doğrulanmış yedek al. MySQL `MYSQL_USER`/`MYSQL_PASSWORD` değişkenlerini yalnızca
boş veri dizininin ilk kurulumunda uygular. Mevcut volume'de `.env.prod` değiştirmek
kullanıcı oluşturmaz veya root parolasını değiştirmez.

1. `MYSQL_ROOT_PASSWORD` değerine mevcut yönetici parolasını yaz.
2. Yönetici oturumunda ayrı kullanıcı oluştur (örnek parolayı kullanma):

   ```sql
   CREATE USER 'kadrom_app'@'%' IDENTIFIED BY '<yeni-guclu-uygulama-parolasi>';
   GRANT ALL PRIVILEGES ON hotel_platform.* TO 'kadrom_app'@'%';
   ```

3. `DB_PASSWORD` yeni uygulama parolasıdır; backend `DB_USERNAME=kadrom_app` kullanır.
   Fly MySQL servisinde `MYSQL_PASSWORD` aynı uygulama parolasıdır. Mevcut kullanıcı
   varsa önce hesabı/yetkilerini incele; otomatik silip yeniden oluşturma.
4. Demo verisi varsa ayrı, temiz üretim veritabanı oluştur veya gerçek kayıtları
   ilişkileriyle birlikte inceleyerek taşı. Sadece demo kullanıcılarını silmek
   diğer örnek kayıtları temizlemez. Canlı veri içeren volume'ü `down -v` ile silme.
5. Migration, açılış ve `/actuator/health` doğrulamasından sonra trafik yönlendir.

## Yerel üretim açılış testi

```bash
docker compose -p hotel-prod-check -f compose.production-check.yml up -d --build
curl http://localhost:8082/actuator/health
docker compose -p hotel-prod-check -f compose.production-check.yml logs backend
docker compose -p hotel-prod-check -f compose.production-check.yml down
```

Bu test ayrı MySQL `tmpfs`, yalnızca loopback portu ve bilinen test anahtarları kullanır.
Verisi geçicidir; canlıya taşınmaz. Gerçek HTTPS, Cloudinary, e-posta ve ödeme
entegrasyonlarını doğrulamaz. `ProductionSafetyTest` yanlış profilleri, root/DDL
ayarlarını ve mevcut demo verisinde veri silmeden açılışın durmasını kontrol eder.

## Kalan yayın öncesi kontroller

- Önceki herkese açık Cloudinary belgelerini sağlayıcı üzerinde envanterle ve
  erişimlerini kaldır/taşı; yeni özel sohbet akışını gerçek hesapla doğrula.
- E-posta, Google giriş, ödeme ve kalıcı VAPID anahtarlarını yapılandırıp doğrula.
  `VapidService` eksik anahtarlarda geçici anahtar üretip özel anahtarı logluyor;
  bu davranış yayın öncesinde kaldırılmalı ve anahtar yönetimi tamamlanmalı.
- Güncel kayıt, başvuru ve sohbet ekranlarının tarayıcı testlerini CI'a ekle.
- Yerel MySQL 8.4 açılışı başarılı; mevcut Flyway sürümü 8.0 üstü için uyumluluk
  uyarısı veriyor. Sürüm yükseltme/sabitleme ayrı olarak doğrulanmalı.
