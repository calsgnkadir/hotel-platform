# Sohbetten belge paylaşımı

Profil ve başvuru sırasında belge toplanmaz. İşletme ihtiyacını sohbette belirtir;
aday dosyayı cihazından sohbet eki olarak paylaşır. Profil doluluk puanı belgeye bağlı değildir.

Yeni ekler Cloudinary `authenticated/raw` türünde, rastgele kimlikle saklanır.
Veritabanındaki `attachment_url` alanı geriye uyumlu olarak depolama referansını tutar;
REST/WebSocket yanıtları yalnızca mesajın uygulama içi indirme yolunu taşır.
İndirme uç noktası oturumu, konuşma üyeliğini ve mesajın o konuşmaya ait olduğunu kontrol eder.
Backend Cloudinary'den dosyayı alır; imzalı sağlayıcı URL'si tarayıcıya verilmez.
Yanıt `Cache-Control: no-store, private` kullanır. Tarayıcı dosyayı kimlik doğrulamalı
API istemcisiyle alıp geçici blob üzerinden gösterir/indirir; bileşen kapanınca blob bırakılır.

## Önceki sürümden geçiş

- Veritabanındaki eski belge veya mesaj kayıtları otomatik silinmez.
- Profil yükleme ve profil belgesini sohbet kartı olarak paylaşma uçları 410 döner.
- Eski profil belgelerinin doğrudan URL dağıtımı ve başvuruda otomatik belge izni kaldırılmıştır.
- Eski herkese açık sohbet ekleri güvenli proxy tarafından açılmaz; kullanıcıdan yeniden paylaşması istenir.
- **Bu kod, Cloudinary'de önceden oluşturulmuş herkese açık nesneleri kendiliğinden özel yapmaz.**
  Gerçek ortamda yayın öncesi eski `documents.file_path` ve `messages.attachment_url` kayıtları
  envanterlenmeli. Nesneler sağlayıcı üzerinde authenticated erişime taşınmalı ve referansları
  güncellenmeli; eski public kopyalar ve CDN önbellekleri geçersizleştirilmelidir.
  Silme kararı verilirse mevcut kullanıcı verisi için saklama kararı ayrıca uygulanmalıdır.
  Gerçek Cloudinary hesabı olmadan bu geçiş ve sağlayıcı üzerinden gerçek yükleme/indirme doğrulanamaz.

## Doğrulama

`PrivateAttachmentStorageTest`: yükleme türü ve eski URL'lerin reddi.
`PrivateChatAndPhoneTest`: konuşma üyeliği, farklı sohbetten mesaj kimliği, DTO gizliliği,
veritabanında kalıcı OTP denemeleri ve beş hatadan sonra kilit.
`PrivateAttachmentHttpTest`: anonim/üçüncü kişi erişiminin reddi, tarafların indirmesi,
cache başlıkları ve profil yükleme yolunun kapatılması.
Frontend `PrivateAttachment.test.jsx`: kimlik doğrulamalı indirme, blob temizliği, hata sonrası tekrar deneme.

Cloudinary erişim modeli: https://cloudinary.com/documentation/control_access_to_media
