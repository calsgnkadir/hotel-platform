# E-posta ve canlı ayar hazırlığı

Kontrol tarihi: 28 Ekim 2026. Bu hazırlık yeni sunucu, alan adı veya ücretli servis gerektirmeden yapıldı. Canlı kurulum yapılmadı.

## Gerçek XLSX ekip listesi denemesi

Kullanıcının onayladığı kişisel Gmail adresine **yalnız bir** gerçek test e-postası gönderildi. Konu: `Kadrom TEST - Ekli ekip listesi`; ek: `kadrom-test-ekip-listesi.xlsx`. Dosyada iki hayali çalışan vardır; telefon, gerçek vardiya veya ödeme bilgisi yoktur.

| Kontrol | Sonuç |
|---|---|
| XLSX oluşturma | Uygulamanın `RosterService.toXlsx` metodu kullanıldı. Oluşan dosya Apache POI ile yeniden açıldı; iki test satırı doğrulandı. |
| Kalıcı kuyruğa ekleme | `EmailService.queueWithAttachment` üzerinden izole H2 veritabanında tek EMAIL kaydı oluşturuldu. Mevcut demo veya üretim veritabanı kullanılmadı. |
| Gerçek sağlayıcı çağrısı | `OutboxRelay` bir kez çalıştırıldı; `EmailService.sendWithAttachment` gerçek Resend API'sine tek HTTP isteği yaptı. API kabul kimliği: `01a18386-b8c6-7656-8508-6f8b25c650fa`. |
| Kuyruk sonucu | Başarılı sağlayıcı yanıtı sonrasında outbox kaydının `processedAt` alanının dolduğu doğrulandı. Geçici Spring/H2 testi: 1 test, 0 hata, Maven başarılı. |
| Gelen kutusu ve ekin kullanıcı tarafından açılması | **Geçti.** Kullanıcı “Geldi, Excel eki de açıldı” yanıtıyla gerçek teslimi ve dosyanın açıldığını doğruladı. Bu, sağlayıcı kabulünden ayrı kullanıcı kanıtıdır. |

Yerel kanıtlar Git'in yok saydığı `hotelapp/target/` altındadır: `kadrom-test-ekip-listesi.xlsx` (3.954 bayt), `single-real-attachment-result.txt` ve Surefire test raporu. Gönderim saati Türkiye saatiyle yaklaşık 20:16'dır. Geçici gerçek gönderim testi ve derlenmiş sınıfları kaldırıldı; normal testlerde veya sonraki Maven çalıştırmalarında tekrar mail göndermez. Tek deneme işaretçisi `single-real-attachment-attempted.marker` saklandı. Tekrar gönderim otomatik başlatılmamalıdır.

Bu deneme gerçek eki ve uygulamanın kuyruk/teslim yolunu kapsar. Tarayıcıdaki yetki kontrolünün, canlı MySQL'in veya henüz kurulmamış üretim sunucusunun uçtan uca testi değildir.

## Gizli ayarların durumu

Değerler rapora veya komut çıktısına yazılmadan kontrol edildi:

- `hotelapp/.env` ve `deploy/prod/.env.prod` Git tarafından yok sayılıyor. Bu dosyalar commit'e eklenmemelidir.
- Resend anahtarı, gönderen adresi ve kalıcı VAPID anahtar çifti iki yerel dosyada da dolu ve birbiriyle aynı. Üretim Compose dosyası bunları backend'e ortam değişkeni olarak iletiyor.
- Üretim dosyasında DB parolaları, JWT anahtarı ve uygulama şifreleme anahtarı dolu. Alanın dolu olması tek başına üretim servisinin başladığı veya anahtarların dışarıda güvenle yedeklendiği anlamına gelmez.
- `CLOUDINARY_URL` iki dosyada da boş. Gerçek üretim ayarlarıyla yapılan `docker compose --env-file deploy/prod/.env.prod -f deploy/prod/docker-compose.prod.yml config --quiet` kontrolü bu zorunlu alan nedeniyle durdu. Canlı kurulumdan önce gerçek görsel yükleme hesabının bilgisi tamamlanmalı; örnek değerle güvenlik kontrolü aşılmamalıdır.
- Üretim Compose yapılandırmasında HTTPS adresi, güvenli cookie, frontend API adresi ve CORS adresi `PUBLIC_URL` üzerinden bağlanıyor. Henüz gerçek sunucuda çalıştırılmadı; DNS/HTTPS ve üretimden e-posta/push teslimi doğrulanmış sayılmaz.

Spring Boot yalnız bir `.env` dosyasının varlığı nedeniyle bu değerleri otomatik yüklemez. Yerel başlatma akışı veya Docker Compose ilgili değişkenleri sürece aktarmalıdır. Anahtarları sohbet, ekran görüntüsü, test çıktısı veya komut satırı argümanı olarak paylaşmayın.

## Kalan doğrulama

1. Sunucu alındığında mevcut kalıcı anahtarlar güvenle aktarılmalı; e-posta gönderen alan adı/DNS durumu ve gerçek HTTPS adresi tekrar kontrol edilmeli.
2. Gerçek üretim ortamında ilk gönderim ve backend yeniden başlatıldıktan sonra iPhone push teslimi doğrulanmalı. Yerel anahtarların hazır olması üretime yükleme kanıtı değildir.

Toplu teslim/kurtarma kayıtları için [RELEASE_DELIVERY_CHECKS.md](RELEASE_DELIVERY_CHECKS.md) kullanılır. Bu belge, gerçek test e-postasına ilişkin ayrıntılı kanıt ve ayar durumunu tutar.
