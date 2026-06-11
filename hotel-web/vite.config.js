import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
      },
      // FAZ 1/#12 — WebSocket handshake'i de backend'e
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
