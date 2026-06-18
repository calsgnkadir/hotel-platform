// FAZ D.7 — Playwright e2e config.
//
// Golden path testleri yerel dev server (Vite + Spring Boot backend) ile koşar.
// Browser binary: ilk kez çalıştırmadan önce `npx playwright install chromium`.
//
// Backend için: backend ayağa kalkmış olmalı (default http://localhost:8080).
// Frontend için: `webServer` config Vite dev server'i otomatik başlatır.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
