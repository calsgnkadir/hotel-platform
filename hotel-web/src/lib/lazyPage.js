import { lazy } from 'react'

const RELOAD_KEY = 'kadrom.chunk-reload'

/**
 * Sayfayı ilk ziyarette ayrı bir JS parçası olarak indirir (React.lazy).
 *
 * Yeni sürüm yayınlanınca eski parça dosyaları sunucudan kalkar; açık kalmış
 * bir sekme eski adı isterse indirme düşer. O durumda sayfa bir kez yenilenir
 * (yeni index.html yeni parça adlarını getirir). İkinci kez de düşerse hata
 * ErrorBoundary'ye gider — sonsuz yenileme döngüsü olmaz.
 */
export function lazyPage(load) {
  return lazy(() => loadWithReload(load))
}

export function loadWithReload(load, reload = () => window.location.reload()) {
  return load()
    .then(mod => {
      try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* yok say */ }
      return mod
    })
    .catch(err => {
      let reloaded = true
      try { reloaded = sessionStorage.getItem(RELOAD_KEY) === '1' } catch { /* yok say */ }
      if (!reloaded) {
        try { sessionStorage.setItem(RELOAD_KEY, '1') } catch { /* yok say */ }
        reload()
        return new Promise(() => {})  // yenilenene kadar bekle
      }
      throw err
    })
}
