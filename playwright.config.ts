import { defineConfig, devices } from '@playwright/test'

// Keep browser binaries inside this project's ignored node_modules directory.
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4175 --strictPort --mode e2e',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    env: { APP_BASE: '/' },
  },
})
