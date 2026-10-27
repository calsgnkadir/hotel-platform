# Hızlandırılmış kafe pilotu

Bu kontroller gerçek kullanıcı, banka hesabı veya canlı veritabanı kullanmaz.
Yedi günün zaman kuralları izole H2 veritabanında; kullanıcı arayüzü ise ayrı
yerel MySQL demo ortamında iki Chrome oturumuyla doğrulanır.

## Yedi günlük senaryo

`WeeklyPilotFlowIT`: işletme, aday ve yetkisiz ikinci işletme kaydı; yedi
vardiyalı ilan; başvuru; ücret/örnek IBAN konuşması; kabul; her gün kişisel
QR giriş kartı; işletmenin girişi onaylaması; GPS çıkışı ve yoklama.
Son vardiya 22:00–06:00 ile ertesi güne taşar. Gerçek kazanç API'si her gün
kontrol edilir: yedi vardiya sonunda 56 saat ve saatlik 125 TL'den 7.000 TL
**tahmini brüt kazanç**. İlan kapanışı ve iki taraftaki kalıcı mesajlar doğrulanır.

Yanlış işletme, değiştirilmiş/eski QR, tekrar giriş ve tekrar çıkış da sınanır.
Makinenin saati değiştirilmez; yalnız testte servis saatleri ilerletilir.

```powershell
# hotelapp klasöründe; mvn PATH'te değilse IntelliJ'in Maven yolunu kullan.
mvn '-Dtest=WeeklyPilotFlowIT,RosterEmailSchedulerTest,SalaryBenchmarkJpaTest' test
```

## İki hesapla gerçek tarayıcı kullanımı

Önkoşul: yalnız bu iş için ayrılmış `dev,demo` backend (8080), demo verileri
ve Vite geliştirme sunucusu (5173). Yerelde kurulu Chrome gerekir.

```powershell
# hotel-web klasöründe
node e2e/pilot-day.mjs
```

Betik demo işletmesiyle ilan oluşturur, yeni örnek aday kaydeder, başvuru ve
kabul yapar; ücret/örnek IBAN mesajlarını iki yönde anlık alır. Gerçek STOMP
bağlantısını yeniden kurup karşılıklı mesajlaşmanın sürdüğünü doğrular.
Adayın QR kartını açar ve aynı kart bağlantısını işletme oturumunda kullanır;
tekrar girişin önlendiğini ve adayın GPS ile çıkış yaptığını kontrol eder.

Demo işletmesinin konumu yoksa test hazırlığı için API üzerinden geçici konum
verilir ve sonunda eski profil geri yüklenir. Oluşturulan test ilanı kapatılır.
Örnek aday/sohbet kayıtları demo veritabanında kalır. Sonuç ve ekran görüntüleri
Git'e alınmayan `hotel-web/test-results/weekly-pilot-browser/` klasörüne yazılır.

## Sınırlar

- QR şu anda giriş içindir; çıkış adayın “Mesaiyi bitir” işlemidir.
- QR bağlantısının yazılım akışı denenir; fiziksel telefon kamerası veya kişinin
  işyerinde bulunması bu testle kanıtlanmaz.
- Tahmini kazanç ve ücret konuşması doğrulanır; banka transferi yapılmaz.
- Hızlandırılmış senaryo gerçek bir haftalık kesintisiz çalışma, JWT eskimesi,
  gerçek e-posta/push teslimi veya üretim yük testi yerine geçmez.
- Ekli ekip listesi e-postasının gerçek sağlayıcıya teslimi canlı anahtarlarla
  ayrıca doğrulanmalıdır; mevcut ekli gönderim kalıcı outbox kuyruğunu kullanmaz.

## Bu denemede düzeltilenler

- Sohbet bağlantısı yenilenince aktif aboneliklerin kaybolması; çıkış ve hesap
  değişiminde eski aboneliklerin temizlenmesi korunur.
- Günlük/ilan kapanışı ekip listesi e-postasında transaction dışında kalan
  işletme sahibi bilgisinin okunamaması.
- Ücret karşılaştırmasında Türkçe yerelde SQL fonksiyon adı, aggregate sayı
  türleri ve sonuç eşlemesi. Karşılaştırma artık yalnız aynı pozisyon ve aynı
  saatlik/günlük/aylık ücret birimi içinde yapılır; birim ekranda gösterilir.
  Birimi eksik veya görüşülecek ücretler karşılaştırılmaz.
- İlan detayındaki QR açıklaması: kartı aday gösterir, işletme görevlisi okutur.

## Son doğrulama — 27 Ekim 2026

- Haftalık akış ve ilgili mapper, yoklama, kazanç, ekip e-postası, ücret karşılaştırması
  kontrollerinde toplam 41 farklı backend testi geçti.
- Sohbet bağlantısı ve ilan detayı için 23 frontend testi geçti.
- Backend paketi ve frontend üretim derlemesi başarılı.
- Son gerçek MySQL/Chrome denemesi 11 kullanım adımını tamamladı; API ve JavaScript
  hata listeleri boş. Saatlik karşılaştırma yalnız saatlik ilanı kapsadı (150 TL/saat).
- Oluşturulan test ilanı kapatıldı, işletmenin eski profil/konum bilgisi geri yüklendi.
