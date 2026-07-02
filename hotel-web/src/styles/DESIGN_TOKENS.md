# Design Tokens — Editorial Dark Luxe

FAZ 5.UX6 consolidation. Single source of truth for tokens, tiers, typography.

## 1. Palette

Primary names (use these):

| Family | Role | Notes |
|---|---|---|
| `graphite.{50→900}` | surfaces + containers | `800` = body bg, `700` = raised, `600` = floating |
| `champagne.{50→900}` | accent | `300` = default (`#cdb78f`), `500`/`600` = CTA gradient (`#d4a853`→`#b8902d`) |
| `ivory.{50→900}` | text ramp | `100` = headline, `200` = body, `400` = secondary, `600` = tertiary |
| `signal.{green,coral,amber}` | status | sage/brick/ochre — badges only, never card bg |

Legacy aliases (`brand.*`, `terra.*`, `neon.*`, `cream.*`, `ink.*`) remap to primary values. Do NOT introduce new usages — write `bg-graphite-700` instead of `bg-brand-700`. Existing usages render correct tones automatically.

## 2. Color roles

- **champagne** = primary CTA + active nav ONLY. **Max 1 accent-filled element per page.**
- **graphite** = passive cards, containers, secondary buttons.
- **signal.\*** = badges ONLY (never card bg, never text alone).

## 3. Card hierarchy (3-tier)

CSS helpers in `tokens.css`. Use these in JSX instead of inline styles.

| Tier | Class | Radius | BG | Border | Shadow | When |
|---|---|---|---|---|---|---|
| GROUND | `.tier-ground` | 12px | `graphite.800` (page) | none | none | passive wrapper |
| RAISED | `.tier-raised` | 16px | `graphite.700` | `1px ivory.900/40` hairline | inset 1px `white/3` | StatCard, list row, msg bubble |
| FEATURED | `.tier-featured` | 16px | `graphite.600` | `1px champagne.300/35` | 8px 24px shadow + inset champagne/12 | selected / new-match / active nav — **≤1/page** |

Hover on RAISED: `.tier-raised-hover` upgrades surface + border on hover without becoming FEATURED.

## 4. Typography (Inter only)

| Class | Size/LH | Weight | Tracking | Color |
|---|---|---|---|---|
| `.type-display` | clamp(28,4.5vw,32)/1.25 | 600 | -0.02em | `ivory.100` |
| `.type-heading` | 20/28 | 600 | -0.01em | `ivory.100` |
| `.type-subhead` | 15/22 | 500 | 0 | `ivory.400` |
| `.type-body` | 14/20 | 400 | 0 | `ivory.200` |
| `.type-caption` | 12/16 | 500 | 0.02em | `ivory.600` |
| `.type-overline` | 10/14 | 600 | 0.22em uppercase | `ivory.600` |

## 5. Acceptance rules

- No page has 2+ equally-bright elements — eye lands once.
- Never use `signal.*` as card background.
- Never use `champagne.300` on more than one CTA/active element per page.
- Cards use tier classes, not ad-hoc inline `background`/`border`/`boxShadow`.
- Text uses `.type-*` classes, not ad-hoc font size + weight.
