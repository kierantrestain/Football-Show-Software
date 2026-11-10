import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:8787', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run studio', url: 'http://127.0.0.1:8787', timeout: 25_000, reuseExistingServer: !process.env.CI },
})
