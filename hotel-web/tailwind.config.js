/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Tema v4 — "Royal Purple" (Hospitality + lüks his):
  // Brand: koyu mor (derin, sofistike). Accent: parlak mor (vurgu).
  // Cream zemin korundu, ink antrasit korundu.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        // FAZ 5.4 — WordPlay benchmark: stratejik kelime vurgusu icin
        bebas:   ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      colors: {
        // ── PRIMARY: Derin mor (regal/lüks tonu)
        brand: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',   // ← ana brand (koyu mor)
          900: '#581c87',   // ← en koyu
        },

        // ── ACCENT: Parlak mor/magenta (CTA + vurgu)
        // Eski 'terra' adı korundu uyumluluk için, değer fuchsia/parlak mor
        terra: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',   // ← accent ana ton (parlak mor)
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
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

        // ── LEGACY uyumluluk
        neon: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
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
          '0%':   { textShadow: '0 0 5px #6b21a8, 0 0 15px #9333ea, 0 0 20px #a855f7' },
          '50%':  { textShadow: '0 0 8px #d946ef, 0 0 20px #c084fc, 0 0 30px #7e22ce' },
          '100%': { textShadow: '0 0 10px #581c87, 0 0 25px #c084fc, 0 0 35px #6b21a8' },
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
        'purple-glow':  '0 0 5px #6b21a8, 0 0 20px #9333ea',
        'magenta-glow': '0 0 5px #d946ef, 0 0 20px #e879f9',
        'soft-glow':    '0 0 5px rgba(168, 85, 247, 0.4), 0 0 20px rgba(168, 85, 247, 0.3)',
      },
    },
  },
  plugins: [],
}
