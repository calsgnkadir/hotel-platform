// FAZ D.7 — Landing page smoke
import { test, expect } from '@playwright/test'

test.describe('Landing', () => {
  test('Landing page yüklenir + brand görünür', async ({ page }) => {
    await page.goto('/')
    // Brand text — AjansHotel / AJANSHOTEL navbar'da gözükür
    await expect(page.locator('body')).toContainText(/Ajanshotel|AJANSHOTEL|İlan|İş/i)
  })

  test('Login linki tıklanabilir', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.getByRole('link', { name: /giriş|login|oturum/i }).first()
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Register linki tıklanabilir', async ({ page }) => {
    await page.goto('/')
    const registerLink = page.getByRole('link', { name: /kayıt|register|üye/i }).first()
    await registerLink.click()
    await expect(page).toHaveURL(/\/register/)
  })
})
