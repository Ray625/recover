/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('mobile layout is centered on wide screens without overflow', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '訓練日誌' })).toBeVisible()
  const dimensions = await page.getByTestId('app-shell').evaluate((el) => ({
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
  await page.getByRole('button', { name: '深色模式', exact: true }).click()
  await expect(page.getByRole('button', { name: '淺色模式', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: '淺色模式', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: '深色模式', exact: true })).toBeVisible()
})
test('unknown routes return to calendar', async ({ page }) => {
  await page.goto('/#/missing')
  await expect(page.getByRole('heading', { name: '訓練日誌' })).toBeVisible()
  await expect(page).toHaveURL(/\/#\/$/)
})

test('account icon switches from open outline to solid when selected', async ({ page }, info) => {
  await page.goto('/')
  const account = page.getByRole('link', { name: '帳戶', exact: true })
  await expect(account.locator('.account-icon--outline')).toBeVisible()
  await expect(account.locator('.account-icon--solid')).toBeHidden()
  await page.screenshot({ path: info.outputPath('account-outline.png') })
  await account.click()
  await expect(account.locator('.account-icon--outline')).toBeHidden()
  await expect(account.locator('.account-icon--solid')).toBeVisible()
  await expect(page.getByRole('heading', { name: '帳戶', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('account-solid.png') })
})

test('page titles align and theme toggle shares settings title row', async ({ page }, info) => {
  let expected: { x: number; y: number; height: number; font: string } | undefined
  for (const [route, title] of [
    ['/', '訓練日誌'],
    ['/#/account', '帳戶'],
    ['/#/stats', '統計'],
    ['/#/settings', '設定'],
  ]) {
    await page.goto(route!)
    const heading = page.getByRole('heading', { name: title!, exact: true })
    const geometry = await heading.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, height: rect.height, font: getComputedStyle(el).fontSize }
    })
    if (!expected) expected = geometry
    else expect(geometry).toEqual(expected)
  }
  const toggle = page.getByRole('button', { name: /^(深色|淺色)模式$/ })
  const bounds = (await toggle.boundingBox())!
  expect(
    Math.abs(bounds.y + bounds.height / 2 - (expected!.y + expected!.height / 2)),
  ).toBeLessThan(2)
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveText('淺色模式')
  await page.screenshot({ path: info.outputPath('settings-dark.png'), fullPage: true })
  await toggle.click()
  await page.screenshot({ path: info.outputPath('settings-light.png'), fullPage: true })
})
