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
| `--ah-warn` / `-soft` | `#8a5a16` / `#f5ecda` | uyarı / bekleyen — sadece durum |
| `--ah-danger` / `-soft` | `#9c3b30` / `#f6e6e3` | hata / acil / tehlikeli aksiyon — sadece durum |
| `--ah-info` / `-soft` | `#3a627e` / `#e8eef4` | bilgi / inceleniyor — sadece durum |
| `--ah-r` / `--ah-rc` | `10px` / `8px` | kart / kontrol radius |

Durum renkleri -soft zemin üstünde de AA (warn 5.0, info 5.6, danger 5.6).

## 2. Renk rolleri

- **grafit (`--ah-brand`)** = birincil CTA + aktif/seçili. Sayfa başına ideal ≤1 dolu-grafit vurgu.
- **beyaz/kırık-beyaz (`--ah-card`/`--ah-page`)** = pasif kartlar, konteynerler, ikincil butonlar.
- **`--ah-ok/warn/danger/info`** = yalnızca DURUM (rozet/şerit/metin). Kart zemini veya ana vurgu olarak KULLANMA.
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

Kural: **11px altı yok**; **büyük harf yalnız durum rozetinde** (`.type-badge`, `.badge`,
`.ah-chip--urgent`). Etiket/başlık/buton cümle düzeninde, tracking 0.

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
| `.type-badge` | 11/14 | 600 | 0.04em, BÜYÜK HARF | yalnız durum rozeti |
| `.type-num` | — | — | — | `tabular-nums` (ücret, sayaç) |

`.stat-card-label` 13px, `.ah-job__band-lbl` 12px ink-3, `.chip` 13px.

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
