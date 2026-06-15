import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/tokens.css'  // FAZ 5.1 — semantic design tokens (hibrit tema)
import './i18n'  // FAZ 1/#36 — i18n init

// FAZ 2/#8 — Service Worker register (PWA offline cache + push handler)
// FAZ 1/#23 push subscription'da webpush.js zaten ensureSWRegistered yapiyor,
// ama PWA fetch handler'in calismasi icin app yuklenince register edilmeli.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW registration failed:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
