// Giriş formu — sunucu gerektirmeyen kontroller
import { test, expect } from '@playwright/test'

test.describe('Giriş formu', () => {
  test('Boş gönderim formda kalır', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Şifre alanı gizli başlar, göster düğmesiyle açılır', async ({ page }) => {
    await page.goto('/login')
    const pw = page.getByPlaceholder('••••••••')
    await pw.fill('test1234')
    await expect(pw).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Şifreyi göster' }).click()
    await expect(pw).toHaveAttribute('type', 'text')
  })

  test('Giriş yapmadan panele girilmez, girişe yönlendirir', async ({ page }) => {
    await page.goto('/candidate')
    await expect(page).toHaveURL(/\/login/)
  })
})
