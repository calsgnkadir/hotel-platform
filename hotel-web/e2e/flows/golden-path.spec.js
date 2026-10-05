// Uçtan uca ana akış — gerçek backend + demo verisi gerekir (E2E_BACKEND=1).
// Kayıt → ilana başvuru → sohbette mesaj → çıkış → tekrar giriş; işletme girişi.
import { test, expect } from '@playwright/test'

test.skip(!process.env.E2E_BACKEND, 'Backend gerekli: E2E_BACKEND=1 ile çalıştır')

// Yerel demo hesapları (DemoSeeder) — sadece dev/demo veritabanında vardır
const DEMO_BUSINESS = { email: 'demo-isletme1@test.com', password: 'Demo1234!' }

// Çerez bandı ve bildirim kartı test akışını kesmesin
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cookie-consent', JSON.stringify({ v: 2, necessaryOnly: true }))
    localStorage.setItem('kadrom.push.snooze-until', String(Date.now() + 7 * 864e5))
  })
})

async function login(page, email, password) {
  await page.goto('/login')
  await page.getByPlaceholder('ornek@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Giriş yap' }).click()
}

test.describe.serial('Aday: kayıt → başvuru → sohbet → tekrar giriş', () => {
  const candidate = {
    name: 'E2E Aday',
    email: `e2e-${Date.now()}@test.com`,
    password: 'E2eTest1234!',
  }
  const message = `Merhaba, vardiya için hazırım ${Date.now()}`

  test('Kayıt olur ve aday paneline girer', async ({ page }) => {
    await page.goto('/register')
    await page.getByText('İş Arıyorum').click()
    await page.getByPlaceholder('Adınız Soyadınız').fill(candidate.name)
    await page.getByPlaceholder('ornek@email.com').fill(candidate.email)
    await page.getByPlaceholder('En az 8 karakter').fill(candidate.password)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Hesap Oluştur' }).click()

    await expect(page).toHaveURL(/\/candidate/, { timeout: 30_000 })
    // exact: menüdeki "Başvurularım" ile karışmasın
    await expect(page.getByRole('button', { name: 'Başvur', exact: true }).first()).toBeVisible({ timeout: 30_000 })
  })

  test('İlana başvurur, onay görünür', async ({ page }) => {
    await login(page, candidate.email, candidate.password)
    await expect(page).toHaveURL(/\/candidate/, { timeout: 30_000 })

    await page.goto('/candidate?tab=listings')
    await page.getByRole('button', { name: 'Başvur', exact: true }).first().click()
    const dialog = page.locator('.modal-content')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('checkbox').first().check()
    await dialog.getByRole('button', { name: 'Başvur', exact: true }).click()

    await expect(dialog.getByText('Başvurun gönderildi')).toBeVisible({ timeout: 30_000 })
  })

  test('Başvurunun açtığı sohbete mesaj yazar, yenileyince de durur', async ({ page }) => {
    await login(page, candidate.email, candidate.password)
    await expect(page).toHaveURL(/\/candidate/, { timeout: 30_000 })

    await page.goto('/candidate?tab=messages')
    const conversation = page.locator('[role="button"]').filter({ hasText: /./ }).first()
    await expect(conversation).toBeVisible({ timeout: 30_000 })
    await conversation.click()

    const composer = page.getByPlaceholder('Mesaj yaz veya foto yapıştır...')
    await composer.fill(message)
    await composer.press('Enter')
    // Mesaj balonu tam olarak bir kez (WS + HTTP yarışında çift balon olmamalı).
    // Sohbet listesindeki önizleme ayrı sayılır: balonlar whitespace-pre-wrap içinde.
    const bubbles = page.locator('.whitespace-pre-wrap', { hasText: message })
    await expect(bubbles).toHaveCount(1, { timeout: 30_000 })

    await page.reload()
    await page.locator('[role="button"]').filter({ hasText: /./ }).first().click()
    await expect(bubbles).toHaveCount(1, { timeout: 30_000 })
  })

  test('Çıkış yapar, aynı bilgilerle tekrar girer', async ({ page }) => {
    await login(page, candidate.email, candidate.password)
    await expect(page).toHaveURL(/\/candidate/, { timeout: 30_000 })

    await page.getByRole('button', { name: 'Ayarlar' }).first().click()
    await page.getByText('Çıkış Yap').click()
    await expect(page).not.toHaveURL(/\/candidate/, { timeout: 30_000 })

    await page.goto('/candidate')
    await expect(page).toHaveURL(/\/login/)

    await login(page, candidate.email, candidate.password)
    await expect(page).toHaveURL(/\/candidate/, { timeout: 30_000 })
  })
})

test('Hatalı şifre girişte kalır ve hata gösterir', async ({ page }) => {
  await login(page, DEMO_BUSINESS.email, 'YanlisSifre1!')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toContainText(/şifre hatalı|sifre hatali/i, { timeout: 10_000 })
})

test('İşletme girer, panelde başvurular görünür', async ({ page }) => {
  await login(page, DEMO_BUSINESS.email, DEMO_BUSINESS.password)
  await expect(page).toHaveURL(/\/business/, { timeout: 30_000 })
  await page.goto('/business?tab=applications')
  await expect(page.locator('body')).toContainText(/başvuru/i, { timeout: 30_000 })
})
