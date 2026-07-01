// FAZ 6 — Register wizard smoke (backend'siz calisan client-side testler)
//
// Register 2 adimli wizard: (1) rol secimi, (2) form. Bu spec sadece
// UI navigation davranisi olcum aliyor — backend'e submit gitmiyor.
import { test, expect } from '@playwright/test'

test.describe('Register wizard', () => {
  test('Step 1: rol kartlari gorunur, seciminde step 2 acilir', async ({ page }) => {
    await page.goto('/register')

    // Header + step indicator
    await expect(page.locator('body')).toContainText(/AjansHotel/i)
    await expect(page.locator('body')).toContainText(/tur/i)   // step indicator label

    // Iki rol kart secenegi
    await expect(page.getByText('İş Arıyorum')).toBeVisible()
    await expect(page.getByText(/eleman arıyorum/i)).toBeVisible()

    // Aday secimi -> step 2
    await page.getByText('İş Arıyorum').click()

    // Step 2'de "Aday" rozeti + Geri butonu
    await expect(page.getByText(/aday/i).first()).toBeVisible()
    await expect(page.getByText(/geri/i).first()).toBeVisible()
  })

  test('Step 2 -> Geri butonu step 1 e doner', async ({ page }) => {
    await page.goto('/register')
    await page.getByText('İş Arıyorum').click()
    await expect(page.getByText(/geri/i).first()).toBeVisible()

    await page.getByText(/geri/i).first().click()

    // Step 1'e dondu — rol kartlari tekrar gorunur
    await expect(page.getByText('İş Arıyorum')).toBeVisible()
    await expect(page.getByText(/eleman arıyorum/i)).toBeVisible()
  })

  test('Isletme rolu secildiyse step 2 rozetinde Isletme Sahibi', async ({ page }) => {
    await page.goto('/register')
    await page.getByText(/eleman arıyorum/i).click()
    await expect(page.getByText(/isletme sahibi|işletme sahibi/i).first()).toBeVisible()
  })

  test('Girise Don linki /login gider', async ({ page }) => {
    await page.goto('/register')
    // Zaten hesabin var mi? -> Giris yap link
    await page.getByRole('link', { name: /giri./i }).first().click()
    await expect(page).toHaveURL(/\/login/)
  })
})
