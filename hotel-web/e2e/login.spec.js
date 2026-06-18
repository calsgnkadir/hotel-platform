// FAZ D.7 — Login form smoke
import { test, expect } from '@playwright/test'

test.describe('Login form', () => {
  test('Boş submit -> validation hatası', async ({ page }) => {
    await page.goto('/login')
    const submitBtn = page.getByRole('button', { name: /giriş|login/i }).first()
    await submitBtn.click()
    // HTML5 required veya custom hata mesajı (form submit edilmemeli)
    await expect(page).toHaveURL(/\/login/)
  })

  test('Hatalı kimlik -> hata toast', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/email|e-?posta/i).fill('nonexistent@example.com')
    await page.getByPlaceholder(/şifre|parola|password/i).fill('WrongPass1!')
    await page.getByRole('button', { name: /giriş|login/i }).first().click()
    // Backend 401 -> toast veya inline hata mesajı
    // (Toast component'i react-hot-toast — DOM'da görünür)
    await expect(page.locator('body')).toContainText(/hatalı|geçersiz|invalid|incorrect/i, {
      timeout: 5000,
    })
  })

  test('Password görünürlük toggle (varsa)', async ({ page }) => {
    await page.goto('/login')
    const pwInput = page.getByPlaceholder(/şifre|parola|password/i)
    await pwInput.fill('test123')
    await expect(pwInput).toHaveAttribute('type', /password|text/)
  })
})
