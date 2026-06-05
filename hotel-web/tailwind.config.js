/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Perdeno yeşili (orta-koyu) — ana brand
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Neon-yeşil accent (Wordplay tarzı parlak vurgu)
        neon: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Dark zemin (StoryHell + Wordplay karışımı — neredeyse siyah)
        ink: {
          900: '#0a0f1c',
          800: '#0f172a',
          700: '#1e293b',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)' },
          '50%':       { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'fade-up': 'fadeUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
      },
      boxShadow: {
        'glow-sm':  '0 2px 12px rgba(16, 185, 129, 0.20)',
        'glow':     '0 4px 20px rgba(16, 185, 129, 0.30)',
        'glow-lg':  '0 8px 32px rgba(16, 185, 129, 0.40)',
      },
    },
  },
  plugins: [],
}
