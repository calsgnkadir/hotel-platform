// Playwright e2e config.
//
// İki grup test:
//  - e2e/smoke  : sunucu gerektirmez (sayfalar, kayıt sihirbazı, form doğrulama)
//  - e2e/flows  : gerçek backend + demo verisi ister (kayıt → başvuru → sohbet → giriş).
//                 E2E_BACKEND=1 değilse atlanır. Backend http://localhost:8080 (Vite proxy).
//
// Tarayıcı: CI'da `npx playwright install --with-deps chromium`.
// Yerelde indirmeden kurulu Chrome ile: PW_CHANNEL=chrome npx playwright test

import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  // Vite dev sayfa parçasını ilk istekte derler; paralel testlerde 5 sn yetmiyor
  expect: { timeout: 15_000 },
  retries: CI ? 1 : 0,
  fullyParallel: true,
  // Tek makinede backend + preview + tarayıcılar; fazla paralellik ilk yüklemeyi 15 sn'ye çıkarıyordu
  workers: CI ? 2 : 3,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    // Uygulama dili tarayıcıdan algılanır; hedef kullanıcı Türkçe
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Derlenmiş sürüm (vite preview) üzerinde koşar: dev sunucusu sayfaları ilk istekte
  // derlerken paralel testlerde /api proxy yanıtları gecikiyordu. Aynı port (5173)
  // → backend CORS ayarı değişmez. Dev sunucusuyla denemek için: E2E_DEV=1
  webServer: {
    command: process.env.E2E_DEV
      ? 'npm run dev'
      : 'npm run build && npx vite preview --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
})
