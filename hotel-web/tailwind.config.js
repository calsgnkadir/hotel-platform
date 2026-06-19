/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Tema v5 — FAZ D2 "Hospitality Night" (lacivert + altin):
  // Brand: koyu lacivert (#1e3a5f) — sofistike, guven verici.
  // Accent: sicak altin (#d4a853) — lüks his + sektör kimliği.
  // Cream zemin korundu, ink antrasit korundu. Eski mor brand/terra adlari
  // korundu (Tailwind class breakage olmasin), degerleri yeni paletle degisti.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        // FAZ 5.4 — WordPlay benchmark: stratejik kelime vurgusu icin
        bebas:   ['"Bebas Neue"', 'Impact', 'sans-serif'],
        // FAZ Auth Redesign — modern geometrik, premium SaaS hissi
        geist:   ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── PRIMARY: Koyu lacivert (hospitality classic)
        brand: {
          50:  '#f1f5fb',
          100: '#dde7f3',
          200: '#b8cae5',
          300: '#8ba9d2',
          400: '#5b85bf',
          500: '#3461a3',
          600: '#234a82',
          700: '#1e3a5f',   // ← ana brand (koyu lacivert)
          800: '#15243d',
          900: '#0c1726',   // ← en koyu
        },

        // ── ACCENT: Sıcak altın (CTA + vurgu)
        // Eski 'terra' adı korundu uyumluluk için, değer altin/amber-warm
        terra: {
          50:  '#fefcf2',
          100: '#fef7d7',
          200: '#fde9a5',
          300: '#fbd768',
          400: '#f7c43c',
          500: '#d4a853',   // ← accent ana ton (sicak altin)
          600: '#b8902d',
          700: '#936b1e',
          800: '#6e4f17',
          900: '#4a3510',
        },

        // ── BACKGROUND: Kremsi off-white (sıcak nötr — korunur)
        cream: {
          50:  '#fdfbf7',
          100: '#faf7f2',
          200: '#f4ede2',
          300: '#ebe0cc',
          400: '#ddccae',
          500: '#c9b388',
        },

        // ── TEXT: Antrasit (korunur)
        ink: {
          50:  '#f8f6f4',
          100: '#e8e4df',
          200: '#cfc8c0',
          300: '#a9a097',
          400: '#766c61',
          500: '#544c45',
          600: '#3d3631',
          700: '#2a2522',
          800: '#1f1c1a',
          900: '#171513',
        },

        // ── LEGACY uyumluluk (eski "neon" mor referansları — yeni paletle altın)
        neon: {
          400: '#f7c43c',
          500: '#d4a853',
          600: '#b8902d',
        },

        // FAZ G.0 — SIGNAL renkleri (durum sinyalleri: kabul, red, ban).
        // Altin "vurgu/CTA" rolunu surdurur, signal'lar yalnizca durum
        // gosterimi (kanban, badge, toast) icin kullanilir. Altinla cakismaz.
        signal: {
          // Yesil — Kabul, Aktif Vardiya, Online presence
          green: {
            DEFAULT: '#3ddc97',
            50:  '#e8fbf2',
            500: '#3ddc97',
            600: '#1fb87a',
            700: '#15875a',
          },
          // Mercan/kirmizi — Red, Ban, Dead-letter, kritik hata
          coral: {
            DEFAULT: '#ef6461',
            50:  '#fdeceb',
            500: '#ef6461',
            600: '#d83d3a',
            700: '#a82c2a',
          },
          // Amber — Bekliyor / hold / warning (mevcut terra'dan ayri durum tonu)
          amber: {
            DEFAULT: '#f59e0b',
            500: '#f59e0b',
            600: '#d97706',
          },
        },
      },
      scale: { '98': '0.98' },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(107, 33, 168, 0.30)' },
          '50%':       { boxShadow: '0 0 0 10px rgba(107, 33, 168, 0)' },
        },
        // FAZ 5.4 — WordPlay benchmark keyframes (mor brand'imize uyarlanmis)
        // textShadow 3 mor ton arasinda gecis — hero baslik icin neon his
        textGlow: {
          // D2: lacivert + altin tonlarinda gecis (eski mor neon yerine)
          '0%':   { textShadow: '0 0 5px #1e3a5f, 0 0 15px #b8902d, 0 0 20px #d4a853' },
          '50%':  { textShadow: '0 0 8px #d4a853, 0 0 20px #f7c43c, 0 0 30px #234a82' },
          '100%': { textShadow: '0 0 10px #0c1726, 0 0 25px #f7c43c, 0 0 35px #1e3a5f' },
        },
        // -10px ile +10px arasinda nazikce kaymasi
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        // Background gradient'i 15sn boyunca konum degistirir — sayfa nefes alir
        gradientXY: {
          '0%, 100%': { backgroundSize: '400% 400%', backgroundPosition: 'left center' },
          '50%':       { backgroundSize: '200% 200%', backgroundPosition: 'right center' },
        },
        // Decorative ikon icin — scale + 360deg rotate
        sparkle: {
          '0%':   { transform: 'scale(1) rotate(0deg)' },
          '50%':  { transform: 'scale(1.2) rotate(180deg)' },
          '100%': { transform: 'scale(1) rotate(360deg)' },
        },
      },
      animation: {
        shimmer:     'shimmer 1.5s infinite',
        'fade-up':   'fadeUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
        // FAZ 5.4 — WordPlay benchmark
        'text-glow':   'textGlow 2s ease-in-out infinite alternate',
        'float-y':     'floatY 3s ease-in-out infinite',
        'gradient-xy': 'gradientXY 15s ease infinite',
        sparkle:       'sparkle 10s linear infinite',
      },
      boxShadow: {
        // Mor glow tonları (eski teal/terra yerine)
        'glow-sm':  '0 2px 12px rgba(107, 33, 168, 0.15)',
        'glow':     '0 4px 20px rgba(107, 33, 168, 0.22)',
        'glow-lg':  '0 8px 32px rgba(107, 33, 168, 0.35)',
        'terra-sm': '0 2px 12px rgba(217, 70, 239, 0.20)',
        'terra':    '0 4px 20px rgba(217, 70, 239, 0.30)',
        // FAZ 5.4 — WordPlay benchmark: double-layer neon glow CTA butonlar icin
        // D2: 'purple-glow' / 'magenta-glow' isimleri korundu (Tailwind class refs varsa kırılmasın), tonlar lacivert+altin
        'purple-glow':  '0 0 5px #1e3a5f, 0 0 20px #b8902d',
        'magenta-glow': '0 0 5px #d4a853, 0 0 20px #f7c43c',
        'soft-glow':    '0 0 5px rgba(168, 85, 247, 0.4), 0 0 20px rgba(168, 85, 247, 0.3)',
      },
    },
  },
  plugins: [],
}
