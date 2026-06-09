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
      },
      animation: {
        shimmer:     'shimmer 1.5s infinite',
        'fade-up':   'fadeUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
      },
      boxShadow: {
        // Mor glow tonları (eski teal/terra yerine)
        'glow-sm':  '0 2px 12px rgba(107, 33, 168, 0.15)',
        'glow':     '0 4px 20px rgba(107, 33, 168, 0.22)',
        'glow-lg':  '0 8px 32px rgba(107, 33, 168, 0.35)',
        'terra-sm': '0 2px 12px rgba(217, 70, 239, 0.20)',
        'terra':    '0 4px 20px rgba(217, 70, 239, 0.30)',
      },
    },
  },
  plugins: [],
}
