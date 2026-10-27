import { test, expect } from '@playwright/test'

// Layout checks use local fixtures; no backend or real account is required.
async function openDashboard(page, role) {
  await page.addInitScript((role) => {
    localStorage.setItem('user', JSON.stringify({
      id: 9001, userId: 9001, role, fullName: 'Arayüz Kontrolü', emailVerified: true,
    }))
    localStorage.setItem('token', 'layout-test-token')
    localStorage.setItem('onboarding-completed-v2', '[9001]')
    localStorage.setItem('cookie-consent', 'seen')
    localStorage.setItem('pwa-install-dismissed-at', String(Date.now()))
  }, role)
  let availableNow = true
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    // Vite also serves source modules below /src/api/.
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let data = []
    if (url.pathname.endsWith('/availability-now')) {
      if (route.request().method() === 'PUT') availableNow = url.searchParams.get('available') === 'true'
      data = { availableNow, availableUntil: '2030-01-01T23:59:00' }
    } else if (url.pathname.endsWith('/unread-count')) {
      data = { count: 0 }
    } else if (url.pathname === '/api/listings') {
      data = [
        { id: 1, businessName: 'Yakın Örnek İşletme', salaryMin: 1000, businessLatitude: 41, businessLongitude: 29 },
        { id: 2, businessName: 'Uzak Örnek İşletme', salaryMin: 2000, businessLatitude: 41.1, businessLongitude: 29.1 },
      ].map(listing => ({
        ...listing, businessId: listing.id + 100, businessDistrict: 'Şişli',
        position: 'WAITER', salaryType: 'DAILY', jobType: 'DAILY', shiftSlots: [],
      }))
    } else if (url.pathname === '/api/business/applications') {
      data = [1, 2].map(id => ({
        id, status: 'PENDING', createdAt: new Date().toISOString(), requestedSlots: [],
        candidate: { id: id + 100, fullName: `Örnek Aday ${id}` },
        listing: { id: 70, title: 'Akşam servisi garson' },
      }))
    }
    await route.fulfill({ json: data })
  })
  await page.route('**/ws/**', route => route.abort())
  await page.goto(role === 'BUSINESS_OWNER' ? '/business' : '/candidate')
}

async function expectUnclipped(locator) {
  await expect(locator).toBeVisible()
  const dimensions = await locator.evaluate(element => ({
    width: element.clientWidth, contentWidth: element.scrollWidth,
    height: element.clientHeight, contentHeight: element.scrollHeight,
  }))
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width + 1)
  expect(dimensions.contentHeight).toBeLessThanOrEqual(dimensions.height + 1)
  await expect(locator).toBeInViewport({ ratio: 1 })
}

for (const width of [320, 375, 390, 639, 640, 768, 1024, 1280, 1440]) {
  test(`İşletme KPI etiketleri ${width}px genişlikte tam okunur`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await openDashboard(page, 'BUSINESS_OWNER')
    const strip = page.getByRole('list', { name: 'Özet sayılar' })
    for (const label of ['Toplam başvuru', 'Son 7 günde gelen', 'Kabul edilen', 'Tamamlanan iş']) {
      await expectUnclipped(strip.getByText(label, { exact: true }))
    }
    await page.screenshot({ path: testInfo.outputPath('business-overview.png'), fullPage: true })
    await strip.getByRole('link', { name: /Toplam başvuru/ }).click()
    await expect(page).toHaveURL(/\/business\?tab=applications$/)
  })

  test(`İlan araçları ${width}px genişlikte kaydırmadan görünür`, async ({ page, context }, testInfo) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 41, longitude: 29 })
    await page.setViewportSize({ width, height: 1000 })
    await openDashboard(page, 'CANDIDATE')
    const sorting = page.getByRole('combobox', { name: 'Sıralama', exact: true })
    const availability = page.getByRole('button', { name: /^Bugün müsait/ })
    const nearby = page.getByRole('button', { name: /^Yakınlar(?: önce)?$/ })
    await expect(availability).toBeEnabled()
    await expect(availability).toHaveAttribute('aria-pressed', 'true')
    for (const control of [sorting, availability, nearby]) await expectUnclipped(control)
    await sorting.selectOption('wage')
    await expectUnclipped(sorting)
    await expect(page.getByTestId('listing-card').first()).toContainText('Uzak Örnek İşletme')
    await nearby.click()
    await expect(nearby).toHaveText('Yakınlar önce')
    await expect(nearby).toHaveAttribute('aria-pressed', 'true')
    await expect(sorting).toBeDisabled()
    await expect(page.getByTestId('listing-card').first()).toContainText('Yakın Örnek İşletme')
    for (const control of [sorting, availability, nearby]) await expectUnclipped(control)
    await page.screenshot({ path: testInfo.outputPath('candidate-listings.png'), fullPage: true })
    await nearby.click()
    await expect(sorting).toBeEnabled()
    await expect(page.getByTestId('listing-card').first()).toContainText('Uzak Örnek İşletme')
    await availability.click()
    await expect(availability).toHaveText('Bugün müsaitim')
    await expectUnclipped(availability)
    await availability.click()
    await expect(availability).toHaveAttribute('aria-pressed', 'true')
    await expectUnclipped(availability)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
