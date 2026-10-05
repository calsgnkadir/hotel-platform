// FAZ D.7 — Landing page smoke
import { test, expect } from '@playwright/test'

test.describe('Landing', () => {
  test('Landing page yüklenir + brand görünür', async ({ page }) => {
    await page.goto('/')
    // Brand text — Kadrom navbar'da gözükür
    await expect(page.locator('body')).toContainText(/Kadrom|İlan|İş/i)
  })

  test('Login linki tıklanabilir', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.getByRole('link', { name: /giriş|login|oturum/i }).first()
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Kayıt Ol: rol + e-posta seçilince kayıt formu hazır açılır', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Kayıt Ol' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Hesap oluştur veya giriş yap' })
    await expect(dialog).toBeVisible()
    await dialog.getByText('İş arıyorum').click()
    await dialog.getByPlaceholder('email@adresin.com').fill('yeni-aday@test.com')
    await dialog.getByRole('button', { name: 'Email ile devam et' }).click()

    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByPlaceholder('ornek@email.com')).toHaveValue('yeni-aday@test.com')
  })
})
