/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+08:00'))
  await page.goto('/')
})

test('month picker jumps across years, clamps day and supports cancel', async ({ page }) => {
  await page.getByRole('button', { name: '2026-11-30', exact: true }).click()
  await page.getByRole('button', { name: '切換年月' }).click()
  const dialog = page.getByRole('dialog', { name: '切換年月' })
  await dialog.getByLabel('年份').fill('2024')
  await dialog.getByLabel('月份', { exact: true }).selectOption('2')
  await dialog.getByRole('button', { name: '確定' }).click()
  await expect(page.getByRole('button', { name: '切換年月' })).toContainText('2024 年 2 月')
  await expect(page.getByRole('button', { name: '2024-02-29', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '切換年月' }).click()
  await dialog.getByLabel('年份').fill('2025')
  await dialog.getByRole('button', { name: '關閉' }).click()
  await expect(page.getByRole('button', { name: '切換年月' })).toContainText('2024 年 2 月')
  await page.getByRole('button', { name: '今日', exact: true }).click()
  await expect(page.getByRole('button', { name: '2026-11-24', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('compact calendar and records stay aligned on narrow phones', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const calendar = page.getByRole('region', { name: '訓練日曆' })
  expect((await calendar.boundingBox())!.height).toBeLessThan(280)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '快速紀錄' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
  }
  await page.getByRole('button', { name: '關閉提示' }).click()
  const cards = page.getByTestId('workout-card')
  const geometry = await cards.first().evaluate((el) => {
    const box = (selector: string) => el.querySelector(selector)!.getBoundingClientRect()
    return {
      checkbox: box('input').left,
      details: box('.workout-details').left,
      category: box('.category-label').top,
      title: box('h3').top,
    }
  })
  expect(Math.abs(geometry.checkbox - geometry.details)).toBeLessThan(1)
  expect(Math.abs(geometry.category - geometry.title)).toBeLessThan(8)
  const first = (await cards.nth(0).boundingBox())!
  const second = (await cards.nth(1).boundingBox())!
  expect(second.y - first.y - first.height).toBeCloseTo(8, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('compact-calendar.png'), fullPage: true })
})
