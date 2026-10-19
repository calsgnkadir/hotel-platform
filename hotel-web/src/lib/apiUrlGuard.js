/**
 * Canlı derleme koruması — VITE_API_URL build anında koda gömülür.
 * Boş/localhost adresle canlıya çıkan paket ya hiçbir backend'e ulaşamaz ya da
 * ziyaretçinin kendi makinesine istek atar. Bu yüzden:
 *
 *  - strict (KADROM_REQUIRE_API_URL=1 — canlı backend yayına alınınca Vercel'de açılır):
 *      boş, localhost veya https olmayan adres → derleme DURUR.
 *  - diğer production derlemeleri (CI "npm run build", Playwright "vite preview",
 *      yerel compose localhost:8081): yalnız uyarı. Bunlar bilinçli olarak aynı
 *      köken (/api proxy) ya da yerel backend kullanır; durdurmak CI'ı kırardı.
 *      Docker imajı ayrıca --build-arg VITE_API_URL olmadan derlenmez (Dockerfile).
 *  - VITE_SHOWCASE=true (vitrin önizlemesi): backend'siz tasarım önizlemesi —
 *      üstte uyarı bandı var, API çağrıları zaten boş durum gösterir; kontrol yok.
 *
 * Dönüş: sorun metni ya da null.
 */
export function apiUrlProblem(apiUrl) {
  const url = (apiUrl || '').trim()
  if (!url) return 'VITE_API_URL tanımlı değil'
  if (/^(https?|wss?):\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(url)) {
    return `VITE_API_URL yerel adres (${url})`
  }
  if (!/^https:\/\//i.test(url)) return `VITE_API_URL https ile başlamalı (${url})`
  return null
}

export function checkProductionApiUrl(env) {
  if (env.VITE_SHOWCASE === 'true') return null
  const problem = apiUrlProblem(env.VITE_API_URL)
  if (!problem) return null
  // VERCEL=1 tek başına sıkı moda almaz: canlı backend henüz yok ve mevcut Vercel arayüz
  // önizlemesinin ortam değişkenleri bilinmiyor; kendiliğinden durdurmak önizlemeyi kırardı.
  const strict = env.KADROM_REQUIRE_API_URL === '1'
  const message = `${problem}. Canlı derleme için örn. VITE_API_URL=https://api.kadrom.me verin.`
  if (strict) throw new Error(`[kadrom] ${message}`)
  return message
}

