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
        // ── PRIMARY palette ───────────────────────────────────────────────
        graphite: {
          50:  '#e8e4dc',
          100: '#c8c0b3',
          200: '#a89c89',
          300: '#7a6e5f',
          400: '#4a3f33',
          500: '#332a20',
          600: '#221f1b',   // surface-floating
          700: '#1b1815',   // surface-raised
          800: '#13110f',   // surface-base (body bg)
          900: '#0c0a08',
        },
        champagne: {
          50:  '#f5efde',
          100: '#ebe1c8',
          200: '#dccaa5',
          300: '#cdb78f',   // default accent
          400: '#b89e6e',
          500: '#a08654',
          600: '#8a7349',
          700: '#6e5b39',
          800: '#52442b',
          900: '#352c1c',
        },
        ivory: {
          50:  '#faf6ec',
          100: '#f5efe2',   // headline
          200: '#ede4d3',   // body
          300: '#dfd2bb',
          400: '#c9bdaa',   // secondary
          500: '#a89c89',
          600: '#928678',   // tertiary
          700: '#6b6358',
          800: '#4d4740',
          900: '#2c2823',
        },
        signal: {
          green: { DEFAULT: '#7a9f7a', 50: '#eaf2ea', 500: '#7a9f7a', 600: '#5e8460', 700: '#456649' },
          coral: { DEFAULT: '#b46a55', 50: '#f5e7e2', 500: '#b46a55', 600: '#94503f', 700: '#723b2d' },
          amber: { DEFAULT: '#c8923a', 500: '#c8923a', 600: '#a3762d' },
        },

        // ── LEGACY aliases — remapped to primary palette (breakage yok) ─────
        // brand.* -> graphite.*, terra.* -> champagne.*, neon.* -> champagne.*
        // cream.* -> ivory.* (dark theme uyumu icin), ink.* -> ivory.* invert
        brand: {
          50:  '#f5efde', 100: '#ebe1c8', 200: '#dccaa5', 300: '#cdb78f',
          400: '#b89e6e', 500: '#a08654', 600: '#8a7349', 700: '#6e5b39',
          800: '#52442b', 900: '#352c1c',
        },
        terra: {
          50:  '#f5efde', 100: '#ebe1c8', 200: '#dccaa5', 300: '#cdb78f',
          400: '#b89e6e', 500: '#d4a853', 600: '#b8902d', 700: '#8a7349',
          800: '#52442b', 900: '#352c1c',
        },
        neon:  { 400: '#d4a853', 500: '#cdb78f', 600: '#b8902d' },
        cream: {
          50: '#221f1b', 100: '#1b1815', 200: '#13110f', 300: '#0c0a08',
          400: '#0c0a08', 500: '#0c0a08',
        },
        ink: {
          50:  '#f5efe2', 100: '#ede4d3', 200: '#dfd2bb', 300: '#c9bdaa',
          400: '#a89c89', 500: '#928678', 600: '#6b6358', 700: '#4d4740',
          800: '#2c2823', 900: '#13110f',
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
