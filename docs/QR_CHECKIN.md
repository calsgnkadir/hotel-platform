# Kişisel QR giriş kartı doğrulaması

Her kart kabul edilmiş bir başvuruya, belirli bir vardiyaya ve vardiyanın başlangıç gününe bağlıdır. Aynı gün birden fazla vardiyası olan aday her vardiya için ayrı kart görür. Kart vardiya gününün başlangıcından vardiya bitişine kadar geçerlidir. Örneğin 3 Ekim 22:00–06:00 vardiyası için son geçerlilik zamanı 4 Ekim 06:00'dır; bitiş anında yeni giriş kabul edilmez.

QR okutma ve listeden **Geldi** işlemleri başvuru satırını veritabanında kilitleyerek mevcut girişi kontrol eder. `work_sessions(application_id, shift_slot_id)` benzersiz kısıtı aynı vardiya için ikinci kaydı ayrıca engeller. GPS giriş akışı da aynı kilidi ve vardiya eşleştirmesini kullanır. Tekrar okutma önceki giriş saatini döndürür.

Gece yarısından sonraki giriş vardiyanın başlangıç günündeki yoklama ve Excel satırına yazılır. Elle giriş isteği `shiftSlotId` gönderir; eski istemciler bu alanı göndermiyorsa yalnızca tek geçerli vardiya bulunduğunda işlem yapılır. Dün başlayan gece vardiyasına, bitiş saatine kadar dünün yoklama ekranından **Geldi** işaretlenebilir.

Okutma ekranında kart adresi değiştiğinde yeni kart işlenir. Önceki isteğin geç gelen yanıtı yeni kişinin ekranını değiştirmez; React StrictMode'un effect tekrarı ikinci istek oluşturmaz.

## Veritabanı geçişi ve eski kartlar

`V18__work_session_shift_identity.sql` nullable `shift_slot_id` kolonu ve benzersiz kısıt ekler. Mevcut migration dosyaları değiştirilmez; eski kayıtlar silinmez. Vardiya kimliği olmayan tarihsel girişler, giriş anında devam eden vardiyaya; böyle bir vardiya yoksa aynı günün sıradaki vardiyasına eşleştirilir. Bu tahmin aynı kaydı iki vardiyada göstermez, ancak eski veride bulunmayan gerçek vardiya tercihini geri getiremez.

Önceden verilmiş yalnız tarih içeren imzalı kartlar, başvurunun o gün tek vardiyası varsa geçerliliğini korur. Birden fazla vardiya varsa aday kartını yeniden açmalıdır. Yeni kartların imzası vardiya kimliğini de kapsar.

QR bağlantısı kopyalanabilir; görevlinin adayın yüzünü/fotoğrafını karşılaştırması gerekir. Kart tek başına fiziksel mevcudiyet kanıtı değildir.

## Tekrar çalıştırma

Depo kökünde, Docker açıkken:

```sh
docker compose -p hotel-qr-tests -f compose.verify.yml run --build --rm backend-tests
docker compose -p hotel-qr-tests -f compose.verify.yml run --build --rm frontend-tests
docker compose -p hotel-qr-tests -f compose.verify.yml run --build --rm backend-mysql-tests
docker compose -p hotel-qr-tests -f compose.verify.yml stop mysql-tests
```

İlk komut H2 üzerinde backend testlerini, ikincisi frontend testlerini çalıştırır. Üçüncüsü ayrı, geçici MySQL veritabanında iki paralel QR isteğini ve QR ile manuel giriş yarışını test eder; uygulamanın veritabanına bağlanmaz. Benzersiz kısıtın doğrudan ikinci kaydı reddettiği de kontrol edilir. Test imajları uygulamanın Dockerfile build aşamalarını kullandığı için Java paketi ve frontend üretim derlemesi de doğrulanır.

Yerel açılış ve migration kontrolü:

```sh
docker compose -p hotel-qr-review up -d --build --wait
docker compose -p hotel-qr-review ps
```

Yerel adres: http://localhost:5174. Bu Compose dosyası `dev,demo` profillerini kullanır; gerçek üretim ortamına dağıtım yapmaz.

## 28 Eylül 2026 doğrulama sonuçları

- Backend: 267 test, sıfır hata ve sıfır atlama (H2 dahil).
- Frontend: 100 test, 14 test dosyası başarılı. Son tur kaynak kullanımını sınırlamak için `npm test -- --maxWorkers=2` ile çalıştırıldı. Önceki yoğun paralel turda mevcut mesajlaşma testi zaman aşımına uğradı; testin zaman aşımı sınırı veya uygulama davranışı değiştirilmedi.
- Ayrı MySQL 8 veritabanı: iki eşzamanlı giriş senaryosu başarılı. QR/QR ve QR/manuel yarışlarında tek kayıt oluştu; doğrudan ikinci kayıt ekleme girişimini benzersiz kısıt reddetti.
- Docker üretim imajları derlendi; mevcut v17 yerel veritabanına V18 başarıyla uygulandı ve backend şema doğrulamasıyla açıldı.
- Fiziksel telefon kamerasıyla uçtan uca QR okuma bu çalışmada yapılmadı; kart görünümü, kart değiştirme ve StrictMode davranışı bileşen testleriyle doğrulandı.
