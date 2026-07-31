# Ekran Görüntüleri

> **Mevcut PNG'ler bayat.** 8 Haziran 2026'da, arayüz açık-teal tasarıma
> geçirilmeden önce çekildiler; koyu/neon temayı gösteriyorlar. README'de
> bunların üstüne uyarı kutusu düşüldü. Aşağıdaki liste yeniden çekim içindir.

Canlı bir backend olmadığı için ekran görüntüleri ve kısa bir tur videosu
projenin **birincil demosu** — yani güncel olmaları önemli.

---

## Nereden çekilecek

Vercel önizlemesinden **çekme** — orada backend yok, giriş yapılamıyor, listeler
boş görünür. Docker stack'ini kaldır:

```bash
docker compose up -d
```

Arayüz: <http://localhost:5174> — demo verisi otomatik yüklenir
(10 aday, 6 işletme, 15 ilan, 68 başvuru).

| Rol | E-posta | Şifre |
| :-- | :-- | :-- |
| Aday | `demo-aday1@test.com` | `Demo1234!` |
| İşletme | `demo-isletme1@test.com` | `Demo1234!` |

---

## Nasıl çekilir

1. Tarayıcı penceresi **1440 × 900**, zoom **%100**
2. Chrome DevTools → `Ctrl+Shift+P` → **"Capture full size screenshot"**
3. PNG'yi bu klasöre, tablodaki adla kaydet
4. 500 KB'ı aşarsa <https://tinypng.com> ile sıkıştır

> Kişisel veri görünmesin: yalnızca demo hesaplarıyla çek, kendi e-postan veya
> telefonun ekranda kalmasın.

---

## Çekilecek liste

Yıldızlı (\*) olanlar giriş gerektirir.

| Dosya | Ekran | Nasıl gidilir |
| :-- | :-- | :-- |
| `landing.png` | Ana sayfa | `/` — hero + vardiya nabzı görünsün |
| `login.png` | Giriş | `/login` |
| `register.png` | Kayıt — rol seçimi | `/register` |
| `kvkk.png` | KVKK aydınlatma metni | `/kvkk` |
| `listing-detail.png` | İlan detayı + harita | İlanlar → bir ilana tıkla |
| `candidate-overview.png` \* | Aday genel bakış | Aday girişi → Genel Bakış |
| `messages.png` \* | Mesajlaşma | Aday girişi → Mesajlar (demo veride 2 sohbet var) |
| `business-applications.png` \* | **Gelen Başvurular — Kanban** | İşletme girişi → Gelen Başvurular → Kanban |
| `business-applications-list.png` \* | **Gelen Başvurular — A4 kart listesi** | Aynı ekran → sağ üstten **Liste** |

Son iki satır yeni: işletme paneli README'de hiç yer almıyordu, oysa Gelen
Başvurular ekranı (Kanban + 3×3 A4 kart ızgarası) projenin en çok emek gören
parçalarından.

> `stats.png` listeden çıkarıldı — Analitik sekmesi projeden kaldırıldı.

---

## Kısa tur videosu (opsiyonel, tavsiye edilir)

2–3 dakikalık sessiz bir ekran kaydı, canlı demonun yerini tutar ve hiç bozulmaz.

Önerilen akış:

1. Landing → işletme ve aday değer önerisi (~15 sn)
2. Aday girişi → ilan listesi → filtre/mesafe → ilan detayı → vardiya seçip
   başvur (~60 sn)
3. İşletme girişi → Gelen Başvurular → Kanban'da kart sürükle-bırak, karar ver (~45 sn)
4. Mesajlaşma → iki taraf arası canlı mesaj (WebSocket) (~20 sn)

Kayıt: Windows'ta `Win+G` (Xbox Game Bar) veya OBS.

> Videoyu **repoya koyma** — GitHub'da 100 MB dosya sınırı var ve `git clone`'u
> kalıcı olarak şişirir. YouTube'a "unlisted" yükleyip README'ye linkle.
