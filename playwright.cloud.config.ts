import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  outputDir: './test-results-cloud',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-cloud-report' }]],
  testIgnore: [],
  testMatch: '**/cloud.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4176' },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4176 --strictPort --mode cloud-e2e',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
    env: {
      APP_BASE: '/',
      VITE_SUPABASE_URL: 'https://fitness-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
