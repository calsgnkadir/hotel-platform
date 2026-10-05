// Genel sayfalar ve çerez bilgilendirmesi — sunucu gerektirmez
import { test, expect } from '@playwright/test'

test.describe('Genel sayfalar', () => {
  test('Bilinmeyen adres 404 sayfası gösterir', async ({ page }) => {
    await page.goto('/olmayan-sayfa')
    await expect(page.getByText('Sayfa bulunamadı')).toBeVisible()
  })

  test('KVKK metni güncel bölümleri içerir', async ({ page }) => {
    await page.goto('/kvkk')
    await expect(page.getByRole('heading', { name: '6. Çerezler' })).toBeVisible()
    await expect(page.locator('body')).toContainText('Sohbet ekleri')
    // Kaldırılan belge arşivi ve puanlama anlatılmaz
    await expect(page.locator('body')).not.toContainText(/kimlik fotokopisi|puanlama/i)
  })

  test('Ana sayfa puanlama vaadi içermez', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).not.toContainText(/puanla|puan ·|değerlendir/i)
  })
})

test.describe('Çerez bilgilendirmesi', () => {
  test('İlk ziyarette görünür, Anladım deyince bir daha çıkmaz', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('region', { name: 'Çerez bilgilendirmesi' })
    await expect(bar).toBeVisible()
    await bar.getByRole('button', { name: 'Anladım' }).click()
    await expect(bar).toBeHidden()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Çerez bilgilendirmesi' })).toHaveCount(0)
  })
})
