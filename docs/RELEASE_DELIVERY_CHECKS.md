# Canlı öncesi teslim ve kurtarma kontrolleri

Son kontrol: 28 Ekim 2026. Bu belge, kod/test ortamındaki kanıt ile gerçek cihaz ve sağlayıcı kanıtını ayrı tutar.

| Kontrol | Sonuç | Kanıt / kalan iş |
|---|---|---|
| Mesai, ekli e-posta ve haftalık senaryo backend regresyonları | Geçti; 75 test | Birim testleri ile gerçek Spring/H2 transaction ve sahte sağlayıcı HTTP testleri. Üretim MySQL veya gerçek posta kutusu kanıtı değildir. |
| Push backend regresyonları | Geçti; 36 test | Abonelik, endpoint politikası ve şifreleme kontrolleri; gerçek iPhone teslimi değildir. |
| Frontend geçmiş işler regresyonları | Geçti; 13 test | Üç test dosyası tek işçiyle yeniden çalıştırıldı; gerçek/planlanan/eksik süre ve istek hatası kapsandı. |
| Backend paketi ve frontend üretim derlemesi | Geçti | Backend 111 testle `package` tamamladı. Frontend yerel/CI ayarlarıyla derlendi; canlı API adresi henüz yapılandırılmadı. |
| Yedek scripti hata güvenliği | Geçti; kontrollü Docker taklidiyle | Başarısız dump kalıcı `.sql.gz` bırakmıyor; `.part` temizleniyor. |
| Bozuk gzip ile restore | Geçti; kontrollü Docker taklidiyle | Arşiv bütünlüğü SQL aktarımından önce kontrol ediliyor; import çağrılmıyor. |
| Restore onayı ve veri akışı | Geçti; kontrollü Docker taklidiyle | `no` aktarımı iptal ediyor; `yes` halinde açılmış dosya baytları kaynakla aynı. Gerçek SQL uygulaması değildir. |
| Boşluk içeren dizinde rotasyon | Geçti; kontrollü Docker taklidiyle | Son iki yedek tutuldu; eski yedek silindi; `KEEP=0` reddedildi. Sıralama dosya değiştirilme zamanına göre. |
| Gerçek MySQL yedek/restore | Geçti; izole MySQL 8.4 | 100 satırın SHA-256 karşılaştırması ve iki outbox kaydı geri yüklendi. Bozuk arşiv veritabanını değiştirmedi; başarısız dump ve rotasyon kontrolleri geçti. |
| V30 MySQL migration + büyük ek | Geçti; izole MySQL 8.4 | Eski üç alanlı EMAIL kaydı korundu; MEDIUMTEXT üzerinde 95.000 bayt ek içeriği saklandı. |
| Gerçek e-posta gelen kutusu | Geçti; geçici test ortamı | Kullanıcı test e-postasını ve uygulamanın gerçek doğrulama e-postasını kendi gelen kutusunda gördü. Ekli ekip listesi ve canlı sunucu ayarları henüz gerçek teslimle sınanmadı. |
| iPhone web push | Geçti; geçici HTTPS demo | Kullanıcı uygulamayı Ana Ekran'a ekleyip izin verdi; demo işletmeden gönderilen mesajın bildirimi telefona ulaştı ve doğru sohbet açıldı. Canlı sunucuda kalıcı VAPID anahtarlarıyla ve yeniden başlatma sonrasında tekrarlanmalı. |
| iPhone kamera ile QR | Geçti; geçici HTTPS demo | İşletme hesabıyla adayın giriş ve çıkış kodları kamerayla okutuldu; tekrar okutma uyarısı ve tek kayıt/doğrulanan çıkış saati kontrol edildi. Canlı ortamda tekrarlanmalı. |
| Kalıcı VAPID anahtar çifti | Yerel hazırlık tamam | Eşleşen P-256 çifti Git'in yok saydığı `hotelapp/.env` dosyasına kaydedildi, biçim ve imza doğrulandı. Canlıya otomatik yüklenmez; sunucuya güvenli aktarım ve restart sonrası teslim testi gerekir. |
| Sunucu dışı yedekten kurtarma | **Doğrulanmadı** | Ayrı depoya kopyalanmış yedekle boş bir ortama dönüş ve veri karşılaştırması gerekli. |

## Tekrar çalıştırılabilir kontroller

Repo kökünden, Bash ortamında:

```bash
# Gerçek prod scriptlerini kontrollü sahte Docker CLI ile sınar; veritabanına erişmez.
bash deploy/prod/tests/backup-safety-test.sh

# Docker çalışırken: ayrı Compose projesi, portsuz MySQL 8.4 ve tmpfs veri dizini.
# Production .env veya mevcut Compose projesi kullanılmaz.
bash deploy/prod/tests/backup-restore-drill.sh
```

İlk komut 28 Ekim 2026'da exit code 0 ile tekrar tamamlandı. İlgili yerel çalışma çıktıları `hotelapp/target/backup-safety-BGpTc0/` altında; üretilen dosyalar Git'e eklenmez.

Gerçek MySQL provasında şu kontroller geçti: eski üç alanlı EMAIL satırını koruyan V30, 95.000 bayt ek içeriğinin MEDIUMTEXT üzerinde saklanması, 100 satırın tamamını içeren SHA-256 karşılaştırmasıyla restore, bozuk arşiv reddi, başarısız dump temizliği ve rotasyon. Kanıt klasörü `hotelapp/target/backup-drill-x4p8gj/`. Script `EXIT` sırasında yalnız kendisinin oluşturduğu geçici Compose projesini kaldırır; MySQL verisi tmpfs olduğu için kalıcı değildir. Çalışma klasörü test kanıtı olarak kalır.

İlk denemede Docker Desktop başlangıç hatası vardı. Kullanıcı Docker'ı açtıktan sonra daemon 29.6.1 ile gerçek prova tamamlandı. Verileri etkileyebilecek factory reset veya mevcut veritabanına müdahale yapılmadı.

## Canlı ortamda tekrarlanacak deneme

1. HTTPS adresini iPhone'da aç; iOS sürümünü kaydet. Aday ve işletme hesapları farklı oturumlarda olsun.
2. Push için web uygulamasını Ana Ekran'a ekle, buradan aç ve uygulamadaki bildirim düğmesine dokunarak izin ver. iOS/iPadOS 16.4 ve sonrası bu akışı destekler. [WebKit açıklaması](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
3. Uygulama arka plandayken diğer hesaptan mesaj oluştur; gerçek cihaz bildiriminin görünmesini ve bildirime dokununca doğru sohbetin açılmasını kontrol et. Focus ve bildirim ayarlarını da kaydet. Telefonu yeniden açtıktan ve backend yeniden başladıktan sonra tekrar dene.
4. Aday giriş QR'ını göstersin, işletme yetkilisi kamerayla okutsun; giriş kaydı oluşsun. Aynı QR tekrarında ikinci kayıt oluşmasın. Çıkışta adayın ayrı çıkış kartını işletme yetkilisi okutsun; çıkışın kaydedildiğini ve tekrar okutmanın zamanı değiştirmediğini doğrula. Geçersiz/süresi geçmiş kodları ve yanlış işletmeyi de kontrol et.
5. Kullanıcının onayladığı kişisel adrese yalnız bir işaretli test e-postası gönder; gerçek gelen kutusu/spam ve ek dosyanın açılmasını kontrol et. API anahtarını sohbet veya test raporuna yazma.
6. Üretim yedeğini sunucu dışında sakla. Boş, ayrı bir ortama geri yükleyip satır/veri karşılaştırmasını kaydet. Başarılı yedek dosyası oluşturulması tek başına kurtarma kanıtı değildir.
