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
  const handle = (await page.getByRole('button', { name: '展開紀錄', exact: true }).boundingBox())!
  const progress = (await page.locator('.records-summary-actions .progress').boundingBox())!
  expect(progress.x).toBeGreaterThanOrEqual(handle.x + handle.width)
  const menu = (await page.getByRole('button', { name: '當日選單', exact: true }).boundingBox())!
  expect(progress.x + progress.width).toBeLessThanOrEqual(menu.x)
  expect(Math.abs(handle.x + handle.width / 2 - 160)).toBeLessThan(1)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '快速紀錄' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
  }
  await page.getByRole('button', { name: '關閉提示' }).click()
  const cards = page.getByTestId('workout-card')
  const geometry = await cards.first().evaluate((el) => {
    const box = (selector: string) => el.querySelector(selector)!.getBoundingClientRect()
    return {
      completion: box('.completion-toggle').left,
      details: box('.workout-details').left,
      category: box('.category-label').top,
      title: box('h3').top,
    }
  })
  expect(Math.abs(geometry.completion - geometry.details)).toBeLessThan(1)
  expect(Math.abs(geometry.category - geometry.title)).toBeLessThan(8)
  const first = (await cards.nth(0).boundingBox())!
  const second = (await cards.nth(1).boundingBox())!
  expect(second.y - first.y - first.height).toBeCloseTo(8, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('compact-calendar.png'), fullPage: true })
})

test('expanded records cover calendar, scroll independently and return without losing changes', async ({
  page,
}, info) => {
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: '快速紀錄' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
  }
  const originalCardBounds = (await page.getByTestId('workout-card').first().boundingBox())!
  const expand = page.getByRole('button', { name: '展開紀錄', exact: true })
  await expand.scrollIntoViewIfNeeded()
  const initialScroll = await page.evaluate(() => window.scrollY)
  const handleBounds = (await expand.boundingBox())!
  const shellBounds = (await page.getByTestId('app-shell').boundingBox())!
  expect(
    Math.abs(handleBounds.x + handleBounds.width / 2 - (shellBounds.x + shellBounds.width / 2)),
  ).toBeLessThan(1)
  await expand.click()
  const region = page.getByRole('region', { name: '當日紀錄' })
  await expect.poll(async () => (await region.boundingBox())!.y).toBeLessThanOrEqual(1)
  const rect = (await region.boundingBox())!
  expect(rect.width).toBeLessThanOrEqual(480)
  const expandedCardBounds = (await region.getByTestId('workout-card').first().boundingBox())!
  expect(Math.abs(expandedCardBounds.width - originalCardBounds.width)).toBeLessThan(1)
  expect(Math.abs(expandedCardBounds.x - originalCardBounds.x)).toBeLessThan(1)
  await expect(page.getByRole('region', { name: '訓練日曆' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '快速紀錄' })).toBeVisible()
  await expect(page.getByRole('button', { name: '收回紀錄', exact: true })).toBeVisible()
  await region
    .getByTestId('workout-card')
    .first()
    .getByRole('button', { name: /^完成 / })
    .click()
  await expect(region.getByText('6 / 7 項完成')).toBeVisible()
  const last = region.getByTestId('workout-card').last()
  await last.getByRole('button', { name: '啞鈴臥推選單' }).click()
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '編輯紀錄' })
  await editor.getByLabel('重量(kg)', { exact: true }).fill('22')
  await editor.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(last).toContainText('22 kg')
  await page.getByRole('button', { name: '快速紀錄' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
  await expect(region.getByText('7 / 8 項完成')).toBeVisible()
  await page.screenshot({ path: info.outputPath('expanded-records.png') })
  await page.getByRole('button', { name: '收回紀錄', exact: true }).click()
  await expect(page.getByRole('region', { name: '訓練日曆' })).toBeVisible()
  await expect(region.getByTestId('workout-card')).toHaveCount(8)
  expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed')
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - initialScroll)).toBeLessThan(2)
  await page.getByRole('button', { name: '展開紀錄', exact: true }).click()
  await page.getByRole('link', { name: '設定', exact: true }).click()
  expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed')
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible()
})

test('record panel animates up from its position and down on collapse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const panel = page.getByRole('region', { name: '當日紀錄' })
  await page.getByRole('button', { name: '展開紀錄', exact: true }).click()
  const up = await panel.evaluate((el) => {
    const animation = el.getAnimations()[0]!
    animation.pause()
    animation.currentTime = 0
    const start = el.getBoundingClientRect().top
    animation.currentTime = 160
    const middle = el.getBoundingClientRect().top
    animation.currentTime = 320
    const end = el.getBoundingClientRect().top
    animation.finish()
    return { start, middle, end }
  })
  expect(up.start).toBeGreaterThan(up.middle)
  expect(up.middle).toBeGreaterThan(up.end)
  expect(up.end).toBeLessThanOrEqual(1)
  const collapse = page.getByRole('button', { name: '收回紀錄', exact: true })
  await expect(collapse).toBeEnabled()
  await collapse.click()
  const down = await panel.evaluate((el) => {
    const animation = el.getAnimations()[0]!
    animation.pause()
    animation.currentTime = 0
    const start = el.getBoundingClientRect().top
    animation.currentTime = 160
    const middle = el.getBoundingClientRect().top
    animation.currentTime = 320
    const end = el.getBoundingClientRect().top
    animation.finish()
    return { start, middle, end }
  })
  expect(down.start).toBeLessThan(down.middle)
  expect(down.middle).toBeLessThan(down.end)
  await expect(page.getByRole('button', { name: '展開紀錄', exact: true })).toBeEnabled()
  await expect(page.getByRole('region', { name: '訓練日曆' })).toBeVisible()
  expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed')
})

test('record panel respects reduced motion when expanding and collapsing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '展開紀錄', exact: true }).click()
  await expect(page.getByRole('button', { name: '收回紀錄', exact: true })).toBeEnabled()
  expect(
    await page
      .getByRole('region', { name: '當日紀錄' })
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0)
  await page.getByRole('button', { name: '收回紀錄', exact: true }).click()
  await expect(page.getByRole('button', { name: '展開紀錄', exact: true })).toBeEnabled()
  await expect(page.getByRole('region', { name: '訓練日曆' })).toBeVisible()
})

test('recorded body parts replace today label and deduplicate per selected date', async ({
  page,
}) => {
  for (const category of ['胸', '肩', '背', '胸']) {
    await page.getByRole('button', { name: '快速紀錄' }).click()
    const dialog = page.getByRole('dialog', { name: '新增紀錄' })
    await dialog.getByLabel('分類', { exact: true }).selectOption({ label: category })
    await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  }
  const parts = page.getByRole('group', { name: '紀錄部位' })
  await expect(parts.locator('.day-part')).toHaveText(['胸', '肩', '背'])
  await expect(page.getByText('・今日', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '啞鈴肩推選單' }).click()
  await page.getByRole('button', { name: '刪除', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '刪除', exact: true }).click()
  await expect(parts.locator('.day-part')).toHaveText(['胸', '背'])
  await page.getByRole('button', { name: '2026-11-25', exact: true }).click()
  await expect(parts).toHaveCount(0)
  await page.getByRole('button', { name: '2026-11-24', exact: true }).click()
  await expect(parts.locator('.day-part')).toHaveText(['胸', '背'])
})

test('collapsing records keeps card position continuous at the animation end', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '快速紀錄' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
  }
  await page.getByRole('button', { name: '展開紀錄', exact: true }).click()
  const collapse = page.getByRole('button', { name: '收回紀錄', exact: true })
  await expect(collapse).toBeEnabled()
  await collapse.click()
  const panel = page.getByRole('region', { name: '當日紀錄' })
  const end = await panel.evaluate((el) => {
    const animation = el.getAnimations()[0]!
    animation.pause()
    animation.currentTime = 320
    const header = el.querySelector('.records-summary-row')!.getBoundingClientRect().top
    const card = el.querySelector('[data-testid="workout-card"]')!.getBoundingClientRect().top
    animation.finish()
    return { header, card }
  })
  await expect(page.getByRole('button', { name: '展開紀錄', exact: true })).toBeEnabled()
  const frames = await panel.evaluate(async (el) => {
    const samples: { header: number; card: number }[] = []
    for (let i = 0; i < 4; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      samples.push({
        header: el.querySelector('.records-summary-row')!.getBoundingClientRect().top,
        card: el.querySelector('[data-testid="workout-card"]')!.getBoundingClientRect().top,
      })
    }
    return samples
  })
  for (const frame of frames) {
    expect(Math.abs(frame.header - end.header)).toBeLessThan(1)
    expect(Math.abs(frame.card - end.card)).toBeLessThan(1)
  }
})
