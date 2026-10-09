# Design Tokens — Açık + Grafit

Tek doğruluk kaynağı: `tokens.css` `:root` (`--ah-*`) + `index.css` `.ah-surface`
scoped override'ları. Bu dosya onları AÇIKLAR, tanımlamaz — çelişki olursa CSS kazanır.

> FAZ 26 pivotu: eski "Editorial Dark Luxe" (koyu kahve + şampanya + ivory) BIRAKILDI.
> Tek tema: sıcak kırık-beyaz zemin, beyaz kart, grafit marka (`#1f2937`). Ara dönemdeki
> teal aksan da bırakıldı. Eski isimler (`champagne/ink/cream/brand/terra/neon`,
> `--text-*`, `graphite/ivory`) silinmedi — alias olarak açık/grafit değerlere remap
> edildi (geriye uyumluluk). Yeni kod `--ah-*` yazsın.

## 1. Palet (`--ah-*`, tokens.css)

| Token | Değer | Rol |
|---|---|---|
| `--ah-brand` | `#1f2937` | marka grafit — birincil CTA, aktif filtre, seçili |
| `--ah-brand-hover` | `#111827` | brand hover |
| `--ah-brand-soft` | `#eef0f2` | grafit-soft zemin (aktif nav, rozet dolgusu) |
| `--ah-brand-gradient` | `135deg brand → brand-hover` | CTA gradienti (tek kaynak) |
| `--ah-page` | `#f2f0ea` | sayfa zemini (sıcak kırık-beyaz) |
| `--ah-card` | `#ffffff` | kart / panel / modal yüzeyi |
| `--ah-band` | `#f4f1ea` | beyaz kart içinde ayrışan iç yüzey, hover zemini |
| `--ah-line` | `#e7e3db` | hairline kenarlık |
| `--ah-line-2` | `#d9d3c8` | daha güçlü kenarlık / hover |
| `--ah-ink` | `#12201f` | başlık metni (beyazda 16.8:1) |
| `--ah-ink-2` | `#3f4b4a` | gövde metni (9.1:1) |
| `--ah-ink-3` | `#5c6564` | ikincil metin (6.0:1) |
| `--ah-ink-4` | `#6b7574` | soluk / placeholder (4.75:1) |
| `--ah-ok` / `-soft` | `#2f6b4f` / `#e7f1eb` | başarı — sadece durum |
| `--ah-warn` / `-soft` | `#8a5a16` / `#f5ecda` | dikkat — YALNIZ "senin eylemin gerekiyor" |
| `--ah-danger` / `-soft` | `#9c3b30` / `#f6e6e3` | hata / acil / tehlikeli aksiyon — sadece durum |
| `--ah-info` / `-soft` | `#3a627e` / `#e8eef4` | bilgi kutusu — rozette KULLANILMAZ |
| `--ah-r` / `--ah-rc` | `10px` / `8px` | kart / kontrol radius |

Durum renkleri -soft zemin üstünde de AA (warn 5.0, info 5.6, danger 5.6).

## 2. Renk rolleri

- **grafit (`--ah-brand`)** = birincil CTA + aktif/seçili. Sayfa başına ideal ≤1 dolu-grafit vurgu.
- **beyaz/kırık-beyaz (`--ah-card`/`--ah-page`)** = pasif kartlar, konteynerler, ikincil butonlar.
- **`--ah-ok/warn/danger/info`** = yalnızca DURUM (rozet/metin; sol renk şeridi kullanılmaz). Kart zemini veya ana vurgu olarak KULLANMA.
- `.card`, `.modal-content`, `.auth-card` içindeki Tailwind `text-red/amber/emerald/blue-*`
  ve `bg-*-50` sınıfları bu token'lara eşlenir (index.css "SEMANTIK DURUM RENKLERI").
  Eskiden hepsi `!important` ile griye eziliyordu; artık eklemeyin.
- İşletme güven satırı: yeşil yalnız `.ah-trust-item--ok` ile (işletme gerçekten
  doğrulanmışsa). Konuma bağlı `:first-child` boyaması yok.
- Logo monogramları: `lib/logoColor.js` (beyaz metinle ≥4.5:1).

## 2b. Modal

- Karartma `.modal-overlay`: `rgba(17,24,39,.5)` + 2px blur, `z-index:1000`, viewport'u
  (üst menü dahil) tamamen kaplar.
- Gövde `.modal-content`: `--ah-card` beyaz, `1px --ah-line`, radius 12px (mobil bottom
  sheet: üst köşeler 14px), gölge `--elev-3`. Başlık / gövde / alt bar aynı beyaz yüzey.
- Sayfa geçişi `.page-enter` YALNIZ opacity animasyonu kullanır. `transform`, `filter`,
  `will-change` veya `animation-fill-mode: both` eklemeyin: `position:fixed` çocuklar
  (modal karartması) için containing block oluşturur, karartma kayar.

**Sabit alt barlı pencere (UI Paket 3, index.css):** `.modal-content.modal-sheet` +
`__head` / `__form` / `__body` / `__foot`. Yalnız `__body` kayar; başlık ve alt bar
(İptal / birincil) mobil bottom sheet'te de hep görünür. Uzun formlu pencerelerde bunu kullan.
Açılışta metin alanına `autoFocus` VERME (mobilde klavye açılır); isteğe bağlı alanlar
"Not ekle" gibi bir ghost butonla açılsın.

**Onay penceresi (`components/ui/ConfirmDialog.jsx`, `useConfirm`):** karartma `.modal-overlay`
ile aynı (`rgba(17,24,39,.5)` + 2px blur, z-1000); panel `--ah-card` + 1px `--ah-line` +
`--elev-3`, radius 12, max 448px. Başlık `.type-card` (büyük harf yok), metin `.type-body` ink-2.
Yıkıcıysa uyarı ikonu `--ah-danger-soft` zemin / `--ah-danger` çizgi. Butonlar: vazgeç
`.btn-secondary` (varsayılan "Vazgeç", açılışta odak burada), onay `.btn-destructive`
(yıkıcı) / `.btn-primary`. Mobilde butonlar alt alta tam genişlik (onay üstte), ≥44px.
`role="dialog"` + `aria-modal` + `aria-labelledby/-describedby`; Esc kapatır, Tab içeride döner.
Onaysız geri alınamaz işlem (abonelik iptali, hesap silme, red) YAPILMAZ.

**Seçim satırı:** `.ah-slot-option` + `data-state="idle|selected|disabled"` — ≥52px dokunma
hedefi, seçili: grafit çerçeve + `--ah-brand-soft` zemin.

**Mobil sabit alt bar (sayfa):** `.mobile-apply-bar` (lg altında fixed, lg+ gizli) + sayfa
köküne `.has-mobile-apply-bar` (içerik barın altında kalmasın). Açıkken `.floating-notice`
kartları barın üstüne kayar.

## 3. Kart hiyerarşisi (3 kademe)

CSS helper'ları tokens.css (`.tier-*`) + `.ah-surface` altında index.css'te. Inline `background/border/boxShadow` yerine bunları kullan.

| Kademe | Class | BG | Border | Gölge | Ne zaman |
|---|---|---|---|---|---|
| GROUND | `.tier-ground` | şeffaf (page) | yok | yok | pasif sarmalayıcı |
| RAISED | `.tier-raised` | `--ah-card` | `1px --ah-line` | yok/çok hafif | StatCard, liste satırı, mesaj balonu |
| FEATURED | `.tier-featured` | `--ah-card` | `1px --ah-brand` (grafit) | `0 4px 14px` hafif | seçili / aktif — **≤1/sayfa** |

`.tier-raised-hover:hover` → border `--ah-line-2` (FEATURED'a dönüşmeden vurgular).
Not: FEATURED border FAZ E'de düzeltildi — eskiden tanımsız `--ah-brand-line` yüzünden gri düşüyordu.

## 4. Tipografi (Inter) — UI Paket 2 ölçeği

Kural: **11px altı yok**; **büyük harf hiçbir yerde yok** (rozet dahil; tek istisna dil
seçicideki dil kodu "TR/EN"). Etiket/başlık/buton/rozet cümle düzeninde, tracking 0.

| Class | Boyut/LH | Ağırlık | Tracking | Ne zaman |
|---|---|---|---|---|
| `.type-page` (= `.type-display`) | 24/32 | 700 | -0.015em | sayfa başlığı (H1) |
| `.type-section` | 18/26 | 600 | -0.01em | bölüm başlığı (H2, "Bugün") |
| `.type-card` (= `.type-heading`) | 16/22 | 600 | -0.005em | kart / modal başlığı |
| `.type-subhead` | 14/20 | 600 | 0 | alt başlık |
| `.type-body` | 14/20 | 400 | 0 | gövde |
| `.type-meta` | 13/18 | 500 | 0 | ikincil bilgi (ink-3) |
| `.type-caption` | 12/16 | 500 | 0 | küçük ek bilgi |
| `.type-label` (= `.type-overline`, `.label`) | 12/16 | 600 | 0 | alan etiketi — büyük harf YOK |
| `.type-badge` | 12/16 | 600 | 0 | küçük vurgulu metin (büyük harf YOK) |
| `.type-num` | — | — | — | `tabular-nums` (ücret, sayaç) |

`.stat-card-label` 13px, `.ah-job__band-lbl` 12px ink-3, `.chip` 13px.

## 4c. Durum rozeti ve durum dili (Durum dili paketi)

**Tek kaynak:** `src/lib/applicationStatus.js` — her başvuru enum'u için
`{ candidate: {label, tone, hint?}, business: {label, tone, hint?} }`, ayrıca
`STANDBY_OFFER`, `NO_SHOW`, aday filtre grupları (`CAND_FILTER_GROUPS`) ve işletme filtre
etiketleri (`BUSINESS_FILTER_LABELS`). Rozet bileşeni: `components/candidate/StatusBadge.jsx`
(`view="candidate"|"business"`); işletme `pages/business/components/Badges.jsx` aynı
kaynağı sarar. Ekranda durum metni elle yazılmaz.

**`.badge`:** 12/16, 600, cümle düzeni, tracking 0, padding 2px 8px, radius 999.
Çerçeve YOK, nokta YOK, sol renk şeridi YOK — yalnız yumuşak zemin + koyu metin.

| Ton sınıfı | Renk | Ne zaman |
|---|---|---|
| `.badge-neutral` | `--ah-band` / `--ah-ink-2` | bilgi (varsayılan) |
| `.badge-attention` | `--ah-warn-soft` / `--ah-warn` | YALNIZ "senin bir şey yapman gerekiyor" |
| `.badge-positive` | `--ah-ok-soft` / `--ah-ok` | olumlu sonuç (Kabul edildi, Aktif) |
| `.badge-negative` | `--ah-danger-soft` / `--ah-danger` | yalnız "İşe gelmedi" ve "Acil" |

Ton bakış açısına göre değişir: aday için HELD "Yanıtın bekleniyor" = dikkat; işletme için
aynı durum "Aday onayında" = nötr (işletmenin yapacağı bir şey yok). Eski
`badge-pending/accepted/rejected` takma ad; `badge-reviewing/expired` nötre indi (info tonu
rozette yok; ink-4 band üstünde 4.5:1 altındaydı).

**Kurallar:** etiket 1-2 kelime; satır başına en fazla 1 durum rozeti ("İşe gelmedi" ikinci
olabilir). **Rozet ≠ bilgi metni:** sayı, son tarih, kontenjan ("3 kişi aranıyor", "Doldu",
"Son: 12 Eki 18:00", "2 iş") rozet değil düz metindir (`.type-meta`/`.type-caption`,
ink-2/ink-3/ink-4); hap/zemin almaz. Kontenjan dolu = ink-4 metin, kırmızı DEĞİL.
Filtre çipleri `aria-pressed` taşır; mobilde ≥44px.

## 4b. Butonlar (index.css)

| Class | Görünüm | Ne zaman |
|---|---|---|
| `.btn-primary` | dolu grafit, beyaz metin | birincil (sayfa başına ideal 1). Geriye uyum için `width:100%`; satır içinde `!w-auto` |
| `.btn-secondary` | beyaz + 1px `--ah-line-2` | ikincil |
| `.btn-ghost` / `.btn-tertiary` | yalnız metin, hover `--ah-band` | üçüncül |
| `.btn-danger` | kırmızı metin + kırmızı çerçeve | sayfa içi tehlikeli aksiyon |
| `.btn-destructive` | dolu kırmızı | YALNIZ onay penceresinin son adımı |

Ortak: 14px/600, cümle düzeni, tracking 0, radius 10px, yükseklik 40px (≤767px'de 44px).
Durumlar: hover, `:active` 1px aşağı, `:disabled` opacity .5. `.ah-btn` aynı ölçekte.

**Odak halkası** (global `*:focus-visible`): 2px `--ah-brand` outline, offset 2px +
`box-shadow: 0 0 0 2px #fff` (aradaki boşluk beyaz) — koyu dolu butonda da görünür.

**Katmanlar:** DashboardLayout `<main>` z-index/position TAŞIMAZ (eskiden `relative z-10`
modal karartmasını üst menünün altına hapsediyordu). Üst menü `sticky z-40`; modal karartması
z-1000, CommandPalette z-100, toast 9999 kök bağlamda.

## 5. Glow YOK (ITEM 5)

Düz elevation ölçeği `--elev-1/2/3` (nötr `rgba(57,57,57,…)` gölge; bkz tokens.css). Renkli
`0 0 Npx` glow, `drop-shadow` halo, radial-blur blob KULLANMA — "AI/luxe" tell'i.

## 6. Kabul kuralları

- Metin `--ah-ink*` / `.type-*` kullanır; beyaz/ivory metni yalnızca RENKLİ zemin üstünde (buton/monogram/avatar).
- `--ah-ok/warn/danger/info` kart zemini olamaz.
- Kartlar tier class'ları kullanır, ad-hoc inline `background/border/boxShadow` değil.
- Kullanılan her `var(--ah-*)` tokens.css'te TANIMLI olmalı (tanımsız var → border currentColor'a düşer, FAZ E bug'ı).
- UI'da emoji yok — SVG ikon veya metin.
