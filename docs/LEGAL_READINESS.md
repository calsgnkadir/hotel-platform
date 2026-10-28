# Gerçek kafe pilotu öncesi açık sorular

Kontrol: 28 Ekim 2026. Bu belge görüşme hazırlığıdır; izin veya hukuki uygunluk onayı değildir.
Kullanıcı İŞKUR izni veya izinli büroyla anlaşması bulunmadığını bildirdi.

## İŞKUR'a anlatılacak mevcut ürün

Kadrom; kafelerin vardiya ilanı açtığı, adayların başvurduğu, işletmenin kabul ettiği,
tarafların mesajlaştığı bir uygulamadır. Giriş QR veya konumla, çıkış işletmenin
ayrı QR kartını okutmasıyla kaydedilir. Ücret ekranı tahmini brüt hesabı gösterir;
uygulama bugün çalışan maaşını tahsil etmez ve aktarmaz. Çalışandan ücret alınmaz.
İşletme aboneliği altyapısı bulunur; gerçek ödeme sağlayıcısı henüz etkin değildir.

Gönderilmeye hazır görüşme özeti:

> Bu özelliklerle internet üzerinden vardiyalı iş ilanı ve başvuru hizmeti sunmak
> istiyorum. İş arayandan ücret alınmayacak, çalışan ücreti işletme tarafından
> doğrudan ödenecek. İşletmelere abonelik sunulması değerlendiriliyor.
> Bu faaliyet için hangi izin, bildirim ve koşullar gerekir? İzinli bir büroyla
> çalışmak mümkünse tarafların sorumlulukları ve gerekli sözleşmeler nelerdir?

- Yalnız mevcut çalışanların mesai yönetimi ile yeni işe yerleştirme aracılığının sınırı nedir?
- Ücretsiz pilot ve örnek verilerle tanıtım ile gerçek işe yerleştirme ayrı nasıl değerlendirilir?
- İzin gerekiyorsa başvuru sahibi, personel, teminat ve maliyet koşulları nelerdir?
- İşletme aboneliği, çalışan ücreti, SGK ve uyuşmazlık sorumlulukları nasıl kurulmalıdır?

İŞKUR'un [genelgesi](https://media.iskur.gov.tr/43194/ozel-istihdam-burolari-genelgesi.pdf)
internet aracılığı ve izin konusunu açıklar. İş arayandan ücret konusunun dayanağı
[4904 sayılı Kanun madde 19](https://media.iskur.gov.tr/22421/turkiye-is-kurumu-ile-ilgili-bazi-duzenlemeler-hakkinda-kanun.pdf).
Ürüne uygulanacak sonuç kurumdan ve uzman incelemesinden netleştirilmelidir.
Bu özet kuruma gönderilmemiştir.

## KVKK ve kullanım koşulları incelemesi

| Mevcut kaynak | Açık madde / yapılacak iş |
|---|---|
| `hotel-web/src/pages/KvkkPage.jsx`, Veri Sorumlusu | Unvan, adres, başvuru e-postası/KEP yer tutucuları gerçek sorumlu bilgileriyle doldurulmalı. |
| Aynı sayfa, Veri Paylaşımı | Resend gerçek sağlayıcıdır; sayfadaki sağlayıcı yer tutucusu giderilmeli. Barındırmanın Türkiye'de olduğu beyanı seçilen gerçek sunucu ve yedek yeriyle doğrulanmalı. |
| Aynı sayfa, Yurt Dışına Aktarım | Cloudinary, Resend, isteğe bağlı Google, push servisleri ve kullanılan diğer sağlayıcılara giden veri/ülke/amaç ve aktarım mekanizması belirlenmeli. Nominatim adres araması, harita döşemeleri ve dış font istekleri de gerçek ağ envanterinde kontrol edilmeli. Sadece sunucunun Türkiye'de olması bütün aktarımları ortadan kaldırmaz. |
| Aynı sayfa, Saklama Süreleri | Hesap, vardiya, mesaj/ek, güvenlik kayıtları ve yedekler için `[süre]` alanları mevcut silme davranışı ve yükümlülüklerle eşlenmeli; süreler rastgele doldurulmamalı. |
| `hotel-web/src/lib/legal.js` | Mevcut metin sürümü 17 Ekim; QR çıkışıyla yapılan içerik değişikliği ve sonraki nihai metin için sürüm/tarih güncellenmeli. Eski kullanıcıların hangi sürümle kayıt olduğu korunmalı. |
| `hotel-web/src/pages/TermsPage.jsx` | Tarafların gerçek kimliği, ücret/SGK sorumlulukları, iptal/gelmedi itirazı, görevli yokluğu ve kayıt düzeltme süreci uzmanla gözden geçirilmeli. Bir sorumluluk cümlesi tek başına kanuni yükümlülükleri kaldırmaz. |

[KVKK aydınlatma açıklaması](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-)
kimlik, amaç, aktarım, toplama yöntemi/hukuki sebep ve haklar hakkında bilgilendirme unsurlarını açıklar.
[Yurt dışına aktarım açıklaması](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim)
güncel mekanizmalar için başvuru kaynağıdır.

## Bugün tamamlanmış sayılmayanlar

İŞKUR görüşü/izni, nihai KVKK/koşullar, şirket veya vergi kaydı, gerçek sunucu ve
harici yedek seçimi bu belgeyle tamamlanmış olmaz. Gerçek kişilerin işe
yerleştirileceği pilot öncesinde bu açıklar netleştirilmelidir.
