// FAZ D.7 — Public listings browse
// Backend canlı ve seed data demoda mevcut olduğunda anlamlı sonuç verir.
import { test, expect } from '@playwright/test'

test.describe('Public listings browse', () => {
  test('Listings sayfası açılır', async ({ page }) => {
    await page.goto('/listings')
    // Filter pill'leri veya boş state mesajı görünmeli
    await expect(page.locator('body')).toContainText(/ilan|filtre|pozisyon|sonuç/i, {
      timeout: 8000,
    })
  })

  test('Pozisyon filtresi UI mevcut', async ({ page }) => {
    await page.goto('/listings')
    // Filter button veya select görünmeli (UI redesign sonrası chip pattern)
    const filterArea = page.locator('button, select').filter({
      hasText: /garson|bulaşıkçı|resepsiyon|pozisyon|tümü/i,
    })
    await expect(filterArea.first()).toBeVisible({ timeout: 5000 })
  })
})
