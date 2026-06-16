/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // FAZ 0/#4d — Vitest config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
  // sockjs-client browser'da Node 'global' degiskenini kullanir → polyfill
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    // Geliştirmede CORS sorunu yaşamamak için backend'e proxy
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Backend down iken stack trace yagdirma — sade 502 don, frontend
        // kendi retry'ini yapsin (axios interceptor + circuit breaker).
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  status: 502,
                  error: 'Backend Offline',
                  message: 'Sunucuya bağlanılamıyor (port 8080 kapalı)',
                }))
              }
              return  // stack trace logging yapma
            }
            console.error('[vite proxy]', err.message)
          })
        },
      },
      // FAZ 1/#12 — WebSocket handshake'i de backend'e
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          // WS proxy error'unu da sessizlestir
          proxy.on('error', (err) => {
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') return
            console.error('[vite ws proxy]', err.message)
          })
        },
      },
    },
  },
  // FAZ 3/#A3 — Bundle optimize: agir kutuphaneleri ayri chunk'a bol
  // Boylelikle landing/login sayfalari recharts+leaflet+stomp yuklemez,
  // sadece dashboard'a girince istenir. Initial JS ~%40 daha kucuk.
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'charts':          ['recharts'],
          'map':             ['leaflet', 'react-leaflet'],
          'realtime':        ['@stomp/stompjs', 'sockjs-client'],
          'i18n':            ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'forms':           ['react-hook-form', 'react-image-crop'],
          'query':           ['@tanstack/react-query'],
        },
      },
    },
  },
})
