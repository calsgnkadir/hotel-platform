# Design Tokens — Açık + Teal (light-teal)

Tek doğruluk kaynağı: `tokens.css` `:root` (`--ah-*`) + `index.css` `.ah-surface`
scoped override'ları. Bu dosya onları AÇIKLAR, tanımlamaz — çelişki olursa CSS kazanır.

> FAZ 26 pivotu: eski "Editorial Dark Luxe" (grafit + şampanya + ivory) BIRAKILDI.
> Artık tek tema açık zemin + teal aksan. Eski isimler (`champagne/ink/cream/
> brand/terra/neon`, `--text-*`, `graphite/ivory`) silinmedi — hepsi alias olarak
> teal/açık değerlere remap edildi (geriye uyumluluk). Yeni kod `--ah-*` yazsın.

## 1. Palet (`--ah-*`, tokens.css)

| Token | Değer | Rol |
|---|---|---|
| `--ah-brand` | `#0f766e` | birincil aksan — CTA, aktif nav, seçili |
| `--ah-brand-hover` | `#0b5d57` | brand hover |
| `--ah-brand-soft` | `#e4f2f0` | teal-soft zemin (aktif pill, rozet dolgusu) |
| `--ah-page` | `#eef1f2` | sayfa zemini |
| `--ah-card` | `#ffffff` | kart/panel yüzeyi |
| `--ah-band` | `#f5f7f7` | beyaz kart içinde ayrışan iç yüzey ("karar kutusu") |
| `--ah-line` | `#e4e8e8` | hairline kenarlık |
| `--ah-line-2` | `#d4dadb` | daha güçlü kenarlık / hover |
| `--ah-ink` | `#12201f` | başlık metni |
| `--ah-ink-2` | `#3f4b4a` | gövde metni |
| `--ah-ink-3` | `#6b7574` | ikincil metin |
| `--ah-ink-4` | `#98a1a0` | soluk / placeholder |
| `--ah-ok` / `-soft` | `#0a7c42` / `#e9f5ee` | başarı — sadece durum |
| `--ah-warn` / `-soft` | `#b7791f` / `#fbf1e0` | uyarı — sadece durum |
| `--ah-danger` / `-soft` | `#c0392b` / `#fbeae7` | hata/acil — sadece durum |
| `--ah-info` / `-soft` | `#1f57c3` / `#eaf1fd` | bilgi — sadece durum |
| `--ah-r` / `--ah-rc` | `10px` / `8px` | kart / kontrol radius |

## 2. Renk rolleri

- **teal (`--ah-brand`)** = birincil CTA + aktif nav/seçili. Sayfa başına ideal ≤1 dolu-teal vurgu.
- **beyaz/gri (`--ah-card`/`--ah-page`)** = pasif kartlar, konteynerler, ikincil butonlar.
- **`--ah-ok/warn/danger/info`** = yalnızca DURUM (rozet/şerit). Kart zemini veya ana vurgu olarak KULLANMA.
- Logo monogramları: `lib/logoColor.js` (8 canlı ton, marka teal'i hariç, beyaz metinle ≥4.5:1).

## 3. Kart hiyerarşisi (3 kademe)

CSS helper'ları `.ah-surface` altında (index.css 1077-1080). Inline `background/border/boxShadow` yerine bunları kullan.

| Kademe | Class | BG | Border | Gölge | Ne zaman |
|---|---|---|---|---|---|
| GROUND | `.tier-ground` | şeffaf (page) | yok | yok | pasif sarmalayıcı |
| RAISED | `.tier-raised` | `--ah-card` | `1px --ah-line` | yok/çok hafif | StatCard, liste satırı, mesaj balonu |
| FEATURED | `.tier-featured` | `--ah-card` | `1px --ah-brand` (teal) | `0 4px 14px` hafif | seçili / aktif — **≤1/sayfa** |

`.tier-raised-hover:hover` → border `--ah-line-2` (FEATURED'a dönüşmeden vurgular).
Not: FEATURED border FAZ E'de düzeltildi — eskiden tanımsız `--ah-brand-line` yüzünden gri düşüyordu.

## 4. Tipografi (Inter) — ITEM 6 sonrası gerçek ölçek

| Class | Boyut/LH | Ağırlık | Tracking |
|---|---|---|---|
| `.type-display` | `clamp(20,2.4vw,24)`/1.3 | 700 | -0.015em |
| `.type-heading` | 16/1.4 | 600 | -0.01em |
| `.type-subhead` | 14/1.45 | 600 | 0 |
| `.type-body` | 13.5/1.5 | 400 | 0 |
| `.type-caption` | 12/1.4 | 500 | 0 |
| `.type-overline` | 11/1.4 | 600 | 0.06em (eski 0.22em "luxe yayılma" kaldırıldı) |

## 5. Glow YOK (ITEM 5)

Düz elevation ölçeği `--elev-1/2/3` (açık `rgba(18,32,31,.06/.08/.12)`). Renkli
`0 0 Npx` glow, `drop-shadow` halo, radial-blur blob KULLANMA — "AI/luxe" tell'i.

## 6. Kabul kuralları

- Metin `--ah-ink*` / `.type-*` kullanır; beyaz/ivory metni yalnızca RENKLİ zemin üstünde (buton/monogram/avatar).
- `--ah-ok/warn/danger/info` kart zemini olamaz.
- Kartlar tier class'ları kullanır, ad-hoc inline `background/border/boxShadow` değil.
- Kullanılan her `var(--ah-*)` tokens.css'te TANIMLI olmalı (tanımsız var → border currentColor'a düşer, FAZ E bug'ı).
- UI'da emoji yok — SVG ikon veya metin.
