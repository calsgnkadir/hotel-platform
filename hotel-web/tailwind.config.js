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
          50:  '#eceded', 100: '#cfd2d4', 200: '#a9aeb2', 300: '#767d83', 400: '#464c53',
          500: '#2b2f33', 600: '#1f2937', 700: '#161b22', 800: '#111827', 900: '#0a0d12',
        },
        // Marka/aksan rampasi — grafit-gri (eski teal BIRAKILDI: "sadece gri ve siyah")
        champagne: {
          50: '#f3f4f5', 100: '#e5e7e9', 200: '#cbd0d4', 300: '#9aa1a8', 400: '#5b6570',
          500: '#1f2937', 600: '#111827', 700: '#0d1420', 800: '#0a0e16', 900: '#05080d',
        },
        // Notr gri metin ramp (ink ile ayni): yuksek numara = koyu
        ivory: {
          50: '#f4f6f6', 100: '#e4e8e8', 200: '#c7cfce', 300: '#a7b0af', 400: '#98a1a0',
          500: '#6b7574', 600: '#54605f', 700: '#3f4b4a', 800: '#26302f', 900: '#12201f',
        },
        // Durum renkleri de gri (kullanici karari: semantik renk yok)
        signal: {
          green: { DEFAULT: '#6b7574', 50: '#eef0f2', 500: '#6b7574', 600: '#54605f', 700: '#3f4b4a' },
          coral: { DEFAULT: '#6b7574', 50: '#eef0f2', 500: '#6b7574', 600: '#54605f', 700: '#3f4b4a' },
          amber: { DEFAULT: '#6b7574', 500: '#6b7574', 600: '#54605f' },
        },

        // ── LEGACY alias'lar — grafit-gri'ye remap (sadece gri ve siyah) ──
        brand: {
          50: '#f3f4f5', 100: '#e5e7e9', 200: '#cbd0d4', 300: '#9aa1a8', 400: '#5b6570',
          500: '#1f2937', 600: '#111827', 700: '#0d1420', 800: '#0a0e16', 900: '#05080d',
        },
        terra: {
          50: '#f3f4f5', 100: '#e5e7e9', 200: '#cbd0d4', 300: '#9aa1a8', 400: '#5b6570',
          500: '#1f2937', 600: '#111827', 700: '#0d1420', 800: '#0a0e16', 900: '#05080d',
        },
        neon:  { 400: '#1f2937', 500: '#1f2937', 600: '#111827' },
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
      // FAZ 26 ITEM 4 — Radius tekleştirildi. Referans (Kariyer.net/LinkedIn)
      // 6-12px araliginda kalir; 16/24px "luxe" koseler emekli.
      // md=6, lg=8 Tailwind varsayilani korunur; full (pill/avatar) dokunulmaz.
      borderRadius: {
        xl:   '10px',   // vardi: 12px
        '2xl': '12px',  // vardi: 16px — .card/.input/.btn buradan besleniyor
        '3xl': '14px',  // vardi: 24px
      },
      keyframes: {
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeUp:    { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(107, 117, 116, 0.30)' },
          '50%':      { boxShadow: '0 0 0 10px rgba(107, 117, 116, 0)' },
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
      // FAZ 26 ITEM 5 — Duz elevation olcegi. Glow (renkli 0 0 Npx) emekli;
      // eski isimler back-compat icin duz degerlere baglandi.
      boxShadow: {
        e1: 'var(--elev-1)',
        e2: 'var(--elev-2)',
        e3: 'var(--elev-3)',
        'tier-raised':   'var(--elev-1)',
        'tier-featured': 'var(--elev-2)',
        'accent-glow':   'var(--elev-1)',
        'cta-glow':      'var(--elev-1)',
      },
    },
  },
  plugins: [],
}
