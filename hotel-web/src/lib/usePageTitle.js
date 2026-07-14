import { useEffect } from 'react'

const BASE = 'AjansHotel'

/**
 * FAZ 14.3 — Dinamik document.title (SEO + tab okunabilirligi).
 *
 * SPA'da crawler'larin cogu JS calistirmasa da Google calistirir;
 * dinamik title indexlenen sayfalarda (public business profili, ilan
 * detayi) aramada dogru baslik gosterir. Unmount'ta base title'a doner.
 *
 * usePageTitle('Wave3 Otel — Besiktas')  ->  "Wave3 Otel — Besiktas | AjansHotel"
 * usePageTitle(null)                     ->  degisiklik yok (loading safhasi)
 */
export default function usePageTitle(title) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} | ${BASE}`
    return () => { document.title = prev }
  }, [title])
}
