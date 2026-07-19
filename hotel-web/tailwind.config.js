/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // FAZ 5.UX6 — Token consolidation.
  //   PRIMARY names: graphite / champagne / ivory / signal.
  //   Legacy aliases (brand/terra/neon/cream/ink) remapped to new palette
  //   values (46 dosyada 561 kullanim var — silmek yerine yeni degere baglandi).
  //   Class isimleri isliyor, tonlar dogru gorunuyor.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // ONE family — Inter (400/500/600/700). Legacy alias'lar Inter'e yonlendirir.
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        syne:    ['Inter', 'system-ui', 'sans-serif'],
        bebas:   ['Inter', 'system-ui', 'sans-serif'],
        geist:   ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ═══ FAZ 26 ITEM 3 — Palet acik+teal'e cevrildi ═══
        //   ink   = GERCEK koyu metin (yuksek numara = koyu) — acik zeminde okunur
        //   cream = acik notr yuzey/cizgi
        //   brand/terra/neon/champagne = teal
        //   ivory = notr gri metin (eskiden acik-metin; artik acik zeminde okunur)
        //   graphite/signal = korundu (koyu yuzey + durum renkleri)
        graphite: {
          50:  '#e8e4dc', 100: '#c8c0b3', 200: '#a89c89', 300: '#7a6e5f', 400: '#4a3f33',
          500: '#332a20', 600: '#221f1b', 700: '#1b1815', 800: '#13110f', 900: '#0c0a08',
        },
        // Teal ramp (brand + tum legacy accent alias'lari)
        champagne: {
          50: '#e4f2f0', 100: '#c7e5e1', 200: '#9fd2cc', 300: '#6bbbb1', 400: '#2d968b',
          500: '#0f766e', 600: '#0b5d57', 700: '#094a45', 800: '#073a36', 900: '#052a27',
        },
        // Notr gri metin ramp (ink ile ayni): yuksek numara = koyu
        ivory: {
          50: '#f4f6f6', 100: '#e4e8e8', 200: '#c7cfce', 300: '#a7b0af', 400: '#98a1a0',
          500: '#6b7574', 600: '#54605f', 700: '#3f4b4a', 800: '#26302f', 900: '#12201f',
        },
        signal: {
          green: { DEFAULT: '#7a9f7a', 50: '#eaf2ea', 500: '#7a9f7a', 600: '#5e8460', 700: '#456649' },
          coral: { DEFAULT: '#b46a55', 50: '#f5e7e2', 500: '#b46a55', 600: '#94503f', 700: '#723b2d' },
          amber: { DEFAULT: '#c8923a', 500: '#c8923a', 600: '#a3762d' },
        },

        // ── LEGACY alias'lar — acik+teal'e remap (ITEM 3) ──
        brand: {
          50: '#e4f2f0', 100: '#c7e5e1', 200: '#9fd2cc', 300: '#6bbbb1', 400: '#2d968b',
          500: '#0f766e', 600: '#0b5d57', 700: '#094a45', 800: '#073a36', 900: '#052a27',
        },
        terra: {
          50: '#e4f2f0', 100: '#c7e5e1', 200: '#9fd2cc', 300: '#6bbbb1', 400: '#2d968b',
          500: '#0f766e', 600: '#0b5d57', 700: '#094a45', 800: '#073a36', 900: '#052a27',
        },
        neon:  { 400: '#0f766e', 500: '#0f766e', 600: '#0b5d57' },
        // cream = acik notr yuzey/cizgi (eskiden koyu idi)
        cream: {
          50: '#ffffff', 100: '#f7f9f9', 200: '#f1f4f4', 300: '#e4e8e8', 400: '#d4dadb', 500: '#bcc4c4',
        },
        // ink = gercek koyu metin ramp (yuksek numara koyu). --ah-ink ailesine hizali.
        ink: {
          50:  '#f4f6f6', 100: '#e4e8e8', 200: '#c7cfce', 300: '#a7b0af', 400: '#98a1a0',
          500: '#6b7574', 600: '#54605f', 700: '#3f4b4a', 800: '#26302f', 900: '#12201f',
        },
      },
      scale: { '98': '0.98' },
      keyframes: {
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeUp:    { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(205, 183, 143, 0.30)' },
          '50%':      { boxShadow: '0 0 0 10px rgba(205, 183, 143, 0)' },
        },
        floatY:     { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        gradientXY: {
          '0%, 100%': { backgroundSize: '400% 400%', backgroundPosition: 'left center' },
          '50%':      { backgroundSize: '200% 200%', backgroundPosition: 'right center' },
        },
      },
      animation: {
        shimmer:      'shimmer 1.5s infinite',
        'fade-up':    'fadeUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
        'float-y':    'floatY 3s ease-in-out infinite',
        'gradient-xy': 'gradientXY 15s ease infinite',
      },
      boxShadow: {
        // 3-tier tokens (see DESIGN_TOKENS.md)
        'tier-raised':   'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'tier-featured': '0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(205, 183, 143, 0.12)',
        // Champagne CTA / active nav glow
        'accent-glow':   '0 0 24px rgba(205, 183, 143, 0.30)',
        'cta-glow':      '0 0 0 1px rgba(212, 168, 83, 0.45), 0 8px 24px rgba(212, 168, 83, 0.30)',
      },
    },
  },
  plugins: [],
}
