/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('mobile layout is centered on wide screens without overflow', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '訓練日誌' })).toBeVisible()
  const dimensions = await page
    .getByTestId('app-shell')
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      left: el.getBoundingClientRect().left,
      viewport: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }))
  expect(dimensions.width).toBeLessThanOrEqual(480)
  expect(
    Math.abs(dimensions.left - (dimensions.viewport - dimensions.width) / 2),
  ).toBeLessThanOrEqual(1)
  expect(dimensions.overflow).toBe(false)
  await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true })
  expect(errors).toEqual([])
})
test('theme persists across reload', async ({ page }) => {
  await page.goto('/#/settings')
  const toggle = page.getByRole('checkbox', { name: '深色模式' })
  await toggle.check()
  await page.reload()
  await expect(toggle).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toggle.uncheck()
  await page.reload()
  await expect(toggle).not.toBeChecked()
})
test('unknown routes return to calendar', async ({ page }) => {
  await page.goto('/#/missing')
  await expect(page.getByRole('heading', { name: '訓練日誌' })).toBeVisible()
  await expect(page).toHaveURL(/\/#\/$/)
})
