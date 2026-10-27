import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
// Real local dev/demo only. Seven-day time progression is covered by WeeklyPilotFlowIT;
// this script exercises today's UI and a real STOMP reconnect using the dev module.
const out = 'test-results/weekly-pilot-browser'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { steps: [], apiErrors: [], pageErrors: [], scope: 'Real local backend; UI actions; QR URL opened in employer context, no physical camera or bank transfer' }
const stamp = Date.now()
const title = `Pilot kafe vardiyası ${stamp}`
const name = `Pilot Aday ${stamp}`
const base = 'http://localhost:5173'
let business, candidate
let originalProfile
async function saveProfile(page, profile) {
  const fields = ['name', 'type', 'district', 'address', 'latitude', 'longitude', 'description', 'phone', 'website', 'category', 'instagram', 'facebook', 'workingHours']
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const response = await page.request.put(base + '/api/business/profile', {
    headers: { Authorization: `Bearer ${token}` },
    data: Object.fromEntries(fields.map(key => [key, profile[key]])),
  })
  expect(response.ok()).toBe(true)
  return response.json()
}
async function context(role) {
  const ctx = await browser.newContext({ viewport: { width: role === 'business' ? 1024 : 390, height: 1000 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', permissions: ['geolocation'], geolocation: { latitude: 41, longitude: 29 } })
  await ctx.addInitScript(() => {
    if (window !== window.top || location.protocol !== 'http:') return
    performance.setResourceTimingBufferSize(3000)
    localStorage.setItem('cookie-consent', 'seen')
    localStorage.setItem('onboarding-completed-v2', JSON.stringify(Array.from({ length: 500 }, (_, i) => i + 1)))
    localStorage.setItem('kadrom.push.snooze-until', String(Date.now() + 86400000))
    localStorage.setItem('pwa-install-dismissed-at', String(Date.now()))
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  page.on('pageerror', e => report.pageErrors.push({ role, message: e.message }))
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.status() >= 400) report.apiErrors.push({ role, path: u.pathname, status: r.status() }) })
  return { ctx, page }
}
async function done(step, page) {
  report.steps.push(step)
  console.log(step)
  if (page) await page.screenshot({ path: `${out}/${report.steps.length}.png`, fullPage: true })
}
async function get(page, path) {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const response = await page.request.get(base + path, { headers: { Authorization: `Bearer ${token}` } })
  expect(response.ok(), path).toBe(true)
  const data = await response.json()
  return path === '/api/candidate/applications' ? (data.content ?? data) : data
}
async function send(page, text) {
  const composer = page.getByPlaceholder('Mesaj yaz veya foto yapıştır...')
  await composer.fill(text)
  await composer.press('Enter')
  await expect(page.locator('.whitespace-pre-wrap').filter({ hasText: text })).toHaveCount(1)
  await expect(composer).toHaveValue('')
}
async function socketState(page, reconnect = false) {
  return page.evaluate(async reconnect => {
    // Vite app imports may carry an HMR ?t= revision. Import exactly the module
    // already loaded by the page, otherwise the probe creates a second singleton.
    const resource = performance.getEntriesByType('resource')
      .find(entry => new URL(entry.name).pathname === '/src/lib/websocket.js')
    if (!resource) throw new Error('Vite WebSocket module was not loaded')
    const socket = await import(resource.name)
    if (reconnect) socket.wsForceReconnect()
    return socket.wsGetState()
  }, reconnect)
}
try {
  business = await context('business')
  const bp = business.page
  await expect.poll(async () => {
    const health = await bp.request.get('http://localhost:8080/actuator/health', { timeout: 2000 }).catch(() => null)
    return health?.ok() ?? false
  }, { timeout: 90000, intervals: [1000, 2000] }).toBe(true)
  await bp.goto(base + '/login')
  await bp.getByPlaceholder('ornek@email.com').fill('demo-isletme5@test.com')
  await bp.getByPlaceholder('••••••••').fill('Demo1234!')
  await bp.getByRole('button', { name: 'Giriş yap', exact: true }).click()
  await expect(bp).toHaveURL(/\/business/)
  let profile = await get(bp, '/api/business/profile')
  if (profile.latitude == null || profile.longitude == null) {
    originalProfile = profile
    profile = await saveProfile(bp, { ...profile, latitude: 41, longitude: 29 })
    report.fixtureSetup = 'Demo işletmesine API ile test konumu verildi; sonunda eski profil geri yüklenir.'
  }
  expect(profile.latitude).not.toBeNull()
  expect(profile.longitude).not.toBeNull()
  expect(Number(profile.latitude)).not.toBeNaN()
  await done('İşletme hesabıyla gerçek giriş yapıldı')
  await bp.goto(base + '/business?tab=mylistings')
  await bp.getByRole('button', { name: 'Yeni ilan', exact: true }).click()
  const form = bp.getByRole('dialog', { name: 'Yeni İlan Oluştur' })
  await form.locator('#listing-form-jobType').selectOption('DAILY')
  await form.getByLabel('İlan başlığı *', { exact: true }).fill(title)
  await form.getByLabel('Açıklama *', { exact: true }).fill('Yalnız yerel pilot testi. Servis hazırlığı ve misafir karşılama.')
  await form.getByRole('button', { name: 'Saatlik', exact: true }).click()
  await form.locator('#listing-form-salaryMin').fill('150')
  await form.getByRole('button', { name: 'Haftalık', exact: true }).click()
  await form.getByRole('button', { name: "IBAN'a havale", exact: true }).click()
  await form.locator('#listing-form-paymentNote').fill('Test senaryosu: haftalık hesaplaşma; gerçek para gönderilmez.')
  await form.locator('#listing-form-dressCode').fill('Siyah pantolon, beyaz gömlek.')
  const tr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const date = `${tr.getFullYear()}-${String(tr.getMonth() + 1).padStart(2, '0')}-${String(tr.getDate()).padStart(2, '0')}`
  tr.setMinutes(tr.getMinutes() + 30)
  const start = `${String(tr.getHours()).padStart(2, '0')}:${String(tr.getMinutes()).padStart(2, '0')}`
  await form.locator('input[type=date]').first().fill(date)
  await form.locator('input[type=time]').nth(0).fill(start)
  await form.locator('input[type=time]').nth(1).fill('23:59')
  const created = bp.waitForResponse(r => new URL(r.url()).pathname === '/api/listings' && r.request().method() === 'POST')
  await form.getByRole('button', { name: 'İlan Oluştur', exact: true }).click()
  const listingResponse = await created
  expect(listingResponse.status()).toBe(201)
  const listing = await listingResponse.json()
  report.listingId = listing.id
  await expect(form).toBeHidden()
  await done('Saatlik ücret, haftalık havale ve bugünkü vardiya ile ilan UI üzerinden oluşturuldu', bp)
  candidate = await context('candidate')
  await candidate.ctx.setGeolocation({ latitude: Number(profile.latitude), longitude: Number(profile.longitude) })
  const cp = candidate.page
  await cp.goto(base + '/register')
  await cp.getByText('İş Arıyorum', { exact: true }).click()
  await cp.getByPlaceholder('Adınız Soyadınız').fill(name)
  await cp.getByPlaceholder('ornek@email.com').fill(`pilot-${stamp}@example.test`)
  await cp.getByPlaceholder('En az 8 karakter').fill('PilotTest1234!')
  await cp.getByRole('checkbox').check()
  await cp.getByRole('button', { name: 'Hesap oluştur', exact: true }).click()
  await expect(cp).toHaveURL(/\/candidate/)
  await done('Yeni aday UI üzerinden kayıt oldu')
  await cp.goto(base + `/listings/${listing.id}`)
  await expect(cp.getByText(title, { exact: true }).first()).toBeVisible()
  const benchmark = await get(cp, '/api/listings/salary-benchmark?position=WAITER&salaryType=HOURLY')
  expect(benchmark.count).toBeGreaterThan(0)
  expect(benchmark.salaryType).toBe('HOURLY')
  expect(Number(benchmark.avgMin)).toBe(150)
  report.salaryBenchmark = benchmark
  await cp.getByRole('button', { name: 'Başvur', exact: true }).click()
  const apply = cp.locator('.modal-content')
  await apply.getByRole('checkbox').first().check()
  const applied = cp.waitForResponse(r => new URL(r.url()).pathname === '/api/candidate/applications' && r.request().method() === 'POST')
  await apply.getByRole('button', { name: /vardiyaya başvur$/i }).click()
  expect((await applied).status()).toBe(201)
  const app = await (await applied).json()
  report.applicationId = app.id
  await done('Aday vardiyayı seçip UI üzerinden başvurdu', cp)
  await bp.goto(base + `/business?tab=applications&id=${app.id}`)
  await bp.getByRole('button', { name: 'Kabul et', exact: true }).click()
  const confirmation = bp.getByRole('dialog', { name: 'Adayı kabul et' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Evet, kabul et', exact: true }).click()
  await expect.poll(async () => (await get(cp, '/api/candidate/applications')).find(x => x.id === app.id)?.status).toBe('ACCEPTED')
  await done('İşletme aday başvurusunu UI üzerinden kabul etti', bp)
  const apps = await get(cp, '/api/candidate/applications')
  const conversationId = apps.find(x => x.id === app.id).conversationId
  report.conversationId = conversationId
  await bp.goto(base + `/business?tab=messages&c=${conversationId}`)
  await cp.goto(base + `/candidate?tab=messages&c=${conversationId}`)
  for (const page of [bp, cp]) {
    await expect(page.getByPlaceholder('Mesaj yaz veya foto yapıştır...')).toBeVisible()
    await expect.poll(() => socketState(page), {
      timeout: 20000,
    }).toBe('connected')
  }
  const wage = `Saatlik 150 TL, haftalık hesaplaşma. IBAN bilgisini paylaşır mısınız? TEST ${stamp}`
  const iban = `Yalnız test verisi: TR00 0000 0000 0000 0000 0000 00. Gerçek hesap değildir. TEST ${stamp}`
  await send(bp, wage)
  await expect(cp.locator('.whitespace-pre-wrap').filter({ hasText: wage })).toHaveCount(1, { timeout: 15000 })
  await send(cp, iban)
  await expect(bp.locator('.whitespace-pre-wrap').filter({ hasText: iban })).toHaveCount(1, { timeout: 15000 })
  await cp.reload()
  await expect(cp.locator('.whitespace-pre-wrap').filter({ hasText: iban })).toHaveCount(1)
  await done('İki rol ücret/örnek IBAN konuştu; anlık iletim ve yenileme sonrası kalıcılık doğrulandı', cp)
  await socketState(cp, true)
  await expect.poll(() => socketState(cp), {
    timeout: 20000,
  }).toBe('connected')
  const reconnected = `Bağlantı yenilendi; vardiya konuşmasına devam ediyoruz. TEST ${stamp}`
  await send(bp, reconnected)
  await expect(cp.locator('.whitespace-pre-wrap').filter({ hasText: reconnected })).toHaveCount(1, { timeout: 15000 })
  await send(cp, `Mesajını aldım, kartımı hazırlıyorum. TEST ${stamp}`)
  await expect(bp.locator('.whitespace-pre-wrap').filter({ hasText: `Mesajını aldım, kartımı hazırlıyorum. TEST ${stamp}` })).toHaveCount(1, { timeout: 15000 })
  await done('Gerçek sohbet bağlantısı yenilendi; iki yönlü mesaj iletimi tekrar doğrulandı', cp)
  await cp.goto(base + '/candidate')
  await cp.getByRole('button').filter({ hasText: 'Bugünkü giriş kartın' }).click()
  await expect(cp.getByRole('dialog', { name: 'Giriş kartı' }).locator('svg[width="240"][height="240"]')).toBeVisible()
  const pass = (await get(cp, '/api/candidate/passes')).find(x => x.applicationId === app.id)
  expect(pass).toBeTruthy()
  await done('Aday kendi vardiyasına ait QR giriş kartını açtı', cp)
  await bp.goto(pass.passUrl)
  await expect(bp.getByText(/Giriş yazıldı/)).toBeVisible()
  await expect(bp.getByRole('heading', { name })).toBeVisible()
  await done('QR kartının bağlantısı işletme oturumunda açıldı; giriş kaydedildi', bp)
  await bp.reload()
  await expect(bp.getByText(/Bu kart zaten kullanıldı/)).toBeVisible()
  await done('Aynı QR tekrarında ikinci giriş oluşturulmadı', bp)
  await cp.goto(base + '/candidate?tab=applications')
  await cp.getByRole('button', { name: 'Mesaiyi bitir', exact: true }).click()
  await expect(cp.getByText('Mesaiyi bitirdin', { exact: true })).toBeVisible()
  const token = await cp.evaluate(() => localStorage.getItem('token'))
  const active = await cp.request.get(base + `/api/candidate/work-sessions/${app.id}/active`, { headers: { Authorization: `Bearer ${token}` } })
  expect(active.status()).toBe(204)
  await cp.reload()
  await expect(cp.getByRole('button', { name: 'Mesaiyi bitir', exact: true })).toHaveCount(0)
  await done('Aday konum izniyle UI üzerinden mesaiyi bitirdi; açık mesai kalmadığı doğrulandı', cp)
  expect(report.apiErrors, 'UI kullanımındaki API hataları').toEqual([])
  expect(report.pageErrors, 'UI kullanımındaki JavaScript hataları').toEqual([])
  report.success = true
} catch (error) {
  report.error = error.message
  console.error(error)
  for (const [role, obj] of [['candidate', candidate], ['business', business]]) if (obj) {
    await obj.page.screenshot({ path: `${out}/${role}-failure.png`, fullPage: true }).catch(() => {})
    console.log(role + ': ' + (await obj.page.locator('body').innerText()).slice(-2200))
  }
  process.exitCode = 1
} finally {
  if (report.listingId && business) {
    try {
      const token = await business.page.evaluate(() => localStorage.getItem('token'))
      const closed = await business.page.request.put(base + `/api/listings/${report.listingId}/status?status=CLOSED`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      report.testListingClosed = closed.ok()
    } catch { report.testListingClosed = false }
  }
  if (originalProfile && business) {
    try { await saveProfile(business.page, originalProfile); report.profileRestored = true }
    catch { report.profileRestored = false }
  }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2))
  await browser.close()
}
