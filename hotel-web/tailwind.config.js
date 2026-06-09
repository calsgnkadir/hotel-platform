/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Tema refactor v2 (Yön A — Hospitality Concierge):
  // Dark mode opsiyonel kalır ama varsayılan + tasarım dili LIGHT.
  // Eski 'lacivert + neon-yeşil' brand'i değişti → krem zemin + derin teal + sıcak terracotta.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // UI: Inter (ekran), Display: Fraunces (büyük başlık, "concierge" hissi)
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // ── PRIMARY: Derin petrol/teal (Conrad Hotel + Airbnb dengesi)
        brand: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',   // ← ana brand rengi (önerilen)
          800: '#115e59',
          900: '#134e4a',
        },

        // ── ACCENT: Sıcak terracotta (CTA + önemli badge'ler)
        // Hospitality dilinde insan + sıcaklık katar
        terra: {
          50:  '#fdf3ef',
          100: '#fae0d4',
          200: '#f5c1a8',
          300: '#ee9a73',
          400: '#e07856',   // ← accent ana ton
          500: '#d05f3a',
          600: '#b94a28',
          700: '#9a3b22',
          800: '#7c3220',
          900: '#5c2417',
        },

        // ── BACKGROUND: Kremsi off-white (sıcak nötr)
        cream: {
          50:  '#fdfbf7',
          100: '#faf7f2',   // ← ana background
          200: '#f4ede2',
          300: '#ebe0cc',
          400: '#ddccae',
          500: '#c9b388',
        },

        // ── TEXT: Antrasit (saf siyah değil — sıcak)
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
          900: '#171513',   // ← ana metin
        },

        // ── LEGACY (geçici uyumluluk — eski sayfalar kullanır):
        // ink-900/800/700 artık dark text. Eski dark bg referansları kademeli temizlenir.
        neon: {
          400: '#2dd4bf',   // teal-400'e mapped (eski neon-yeşil yerine)
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      scale: {
        '98': '0.98',
      },
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(15, 118, 110, 0.30)' },
          '50%':       { boxShadow: '0 0 0 10px rgba(15, 118, 110, 0)' },
        },
      },
      animation: {
        shimmer:     'shimmer 1.5s infinite',
        'fade-up':   'fadeUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
      },
      boxShadow: {
        // Yeni: sıcak teal glow (eski neon-yeşil değil)
        'glow-sm':  '0 2px 12px rgba(15, 118, 110, 0.15)',
        'glow':     '0 4px 20px rgba(15, 118, 110, 0.20)',
        'glow-lg':  '0 8px 32px rgba(15, 118, 110, 0.30)',
        // Terracotta accent glow (CTA için)
        'terra-sm': '0 2px 12px rgba(224, 120, 86, 0.20)',
        'terra':    '0 4px 20px rgba(224, 120, 86, 0.30)',
      },
    },
  },
  plugins: [],
}
