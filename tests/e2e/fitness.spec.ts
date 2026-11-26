/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

async function add(page: Page, date?: string) {
  await page.getByRole('button', { name: '快速紀錄' }).click()
  const dialog = page.getByRole('dialog', { name: '新增紀錄' })
  if (date) await dialog.getByLabel('日期', { exact: true }).fill(date)
  return dialog
}
async function openMenu(page: Page, name: string, action: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: action, exact: true }).click()
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00+08:00'))
  await page.goto('/')
})

test('simple record persists, edits and deletes', async ({ page }) => {
  const dialog = await add(page, '2026-10-12')
  await dialog.getByLabel('重量(kg)', { exact: true }).fill('12.5')
  await dialog.getByLabel('組數', { exact: true }).fill('4')
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  const card = page.getByTestId('workout-card')
  await expect(card).toContainText('12.5 kg')
  await expect(card).toContainText('4 組')
  await expect(card.getByRole('button', { name: /^完成 / })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: /^完成 / }).click()
  await expect(card.getByRole('button', { name: /^完成 / })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(card.getByText('Done', { exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: /^完成 / }).click()
  await expect(card.getByText('Done', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '上個月' }).click()
  await page.getByRole('button', { name: '2026-10-12', exact: true }).click()
  await expect(card).toContainText('12.5 kg')
  await openMenu(page, '啞鈴臥推選單', '編輯')
  await page.getByRole('dialog').getByLabel('重量(kg)', { exact: true }).fill('15')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(card).toContainText('15 kg')
  await openMenu(page, '啞鈴臥推選單', '刪除')
  await page.getByRole('dialog').getByRole('button', { name: '刪除', exact: true }).click()
  await expect(card).toHaveCount(0)
})

test('detailed mode retains draft and saves variable sets', async ({ page }, info) => {
  const dialog = await add(page)
  await expect(dialog.getByLabel('已完成')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '各重', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const simpleWeight = (await dialog.getByLabel('重量(kg)', { exact: true }).boundingBox())!
  const simpleCount = (await dialog.getByLabel('組數', { exact: true }).boundingBox())!
  await dialog.getByLabel('逐組詳細紀錄').check()
  const detailedWeight = (await dialog.getByLabel('第 1 組重量').boundingBox())!
  const detailedReps = (await dialog.getByLabel('第 1 組次數').boundingBox())!
  expect(Math.abs(simpleWeight.width - detailedWeight.width)).toBeLessThan(1)
  expect(Math.abs(simpleWeight.x - detailedWeight.x)).toBeLessThan(1)
  expect(Math.abs(simpleCount.x - detailedReps.x)).toBeLessThan(1)
  expect(simpleCount.width - detailedReps.width).toBeCloseTo(44, 0)
  await dialog.getByLabel('第 1 組重量').fill('11')
  await dialog.getByLabel('第 1 組次數').fill('12')
  await dialog.getByLabel('第 2 組重量').fill('12.5')
  await dialog.getByLabel('第 2 組次數').fill('10')
  await dialog.getByLabel('第 3 組次數').fill('8')
  await dialog.getByLabel('逐組詳細紀錄').uncheck()
  await expect(dialog.getByLabel('重量(kg)', { exact: true })).toHaveValue('11')
  await expect(dialog.getByLabel('組數', { exact: true })).toHaveValue('3')
  await dialog.getByLabel('逐組詳細紀錄').check()
  await expect(dialog.getByLabel('第 2 組重量')).toHaveValue('12.5')
  await expect(dialog.getByLabel('第 2 組次數')).toHaveValue('10')
  await dialog.getByRole('button', { name: '總重', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '總重', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(dialog.getByLabel('第 2 組重量')).toHaveValue('12.5')
  await page.screenshot({ path: info.outputPath('detailed-editor.png') })
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toContainText('12.5 kg × 10')
  await expect(page.getByTestId('workout-card')).toContainText('總重')
})

test('single copy opens editable draft, defaults today completed, cancel is safe', async ({
  page,
}) => {
  const dialog = await add(page, '2026-10-12')
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await openMenu(page, '啞鈴臥推選單', '複製')
  const copy = page.getByRole('dialog', { name: '新增紀錄' })
  const today = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  await expect(copy.getByLabel('日期', { exact: true })).toHaveValue(today)
  await expect(copy.getByLabel('已完成')).toHaveCount(0)
  await copy.getByRole('button', { name: '關閉' }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(1)
  await openMenu(page, '啞鈴臥推選單', '複製')
  await page.getByRole('dialog').getByLabel('重量(kg)', { exact: true }).fill('20')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toContainText('20 kg')
  await page.getByRole('button', { name: '上個月' }).click()
  await page.getByRole('button', { name: '2026-10-12', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toContainText('10 kg')
})

test('day copy selects destination, appends and resets completion', async ({ page }) => {
  let dialog = await add(page, '2026-10-12')
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  dialog = await add(page, '2026-10-12')
  await dialog.getByLabel('重量(kg)', { exact: true }).fill('15')
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await openMenu(page, '當日選單', '複製課表')
  await page.getByRole('dialog').getByLabel('日期', { exact: true }).fill('2026-10-13')
  await page.getByRole('dialog').getByRole('button', { name: '複製', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(2)
  for (const check of await page
    .getByTestId('workout-card')
    .getByRole('button', { name: /^完成 / })
    .all())
    await expect(check).toHaveAttribute('aria-pressed', 'false')
  await page
    .getByTestId('workout-card')
    .first()
    .getByRole('button', { name: /^完成 / })
    .click()
  await expect(page.getByText('1 / 2 項完成')).toBeVisible()
  await openMenu(page, '當日選單', '複製課表')
  await page.getByRole('dialog').getByLabel('日期', { exact: true }).fill('2026-10-13')
  await page.getByRole('dialog').getByRole('button', { name: '複製', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(4)
  await expect(page.getByText('1 / 4 項完成')).toBeVisible()
})

test('categories require moving exercises; historical snapshots survive rename and deletion', async ({
  page,
}) => {
  const dialog = await add(page)
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await page.getByRole('link', { name: '設定', exact: true }).click()
  await openMenu(page, '胸分類選單', '刪除')
  await expect(page.getByText('請先將動作移至其他分類')).toBeVisible()
  await openMenu(page, '啞鈴臥推動作選單', '編輯')
  const editDialog = page.getByRole('dialog')
  const saveBounds = (await editDialog
    .getByRole('button', { name: '儲存', exact: true })
    .boundingBox())!
  for (const field of [
    editDialog.getByLabel('名稱'),
    editDialog.getByLabel('分類', { exact: true }),
  ]) {
    const bounds = (await field.boundingBox())!
    expect(Math.abs(bounds.x - saveBounds.x)).toBeLessThan(1)
    expect(Math.abs(bounds.width - saveBounds.width)).toBeLessThan(1)
  }
  await page.getByRole('dialog').getByLabel('名稱').fill('新臥推')
  await page.getByRole('dialog').getByLabel('分類', { exact: true }).selectOption({ label: '背' })
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await openMenu(page, '胸分類選單', '刪除')
  await page.getByRole('dialog').getByRole('button', { name: '刪除', exact: true }).click()
  await expect(page.getByRole('button', { name: '胸分類選單' })).toHaveCount(0)
  await openMenu(page, '新臥推動作選單', '刪除')
  await page.getByRole('dialog').getByRole('button', { name: '刪除', exact: true }).click()
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toContainText('啞鈴臥推')
  await expect(page.getByTestId('workout-card')).toContainText('胸')
  await openMenu(page, '啞鈴臥推選單', '複製')
  await expect(page.getByRole('dialog').getByLabel('動作', { exact: true })).toHaveValue(
    'exercise-0',
  )
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(2)
})

test('backup validates before import and can restore exported records', async ({ page }) => {
  const dialog = await add(page)
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await page.getByRole('link', { name: '設定', exact: true }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '匯出', exact: true }).click()
  const download = await downloadEvent
  const path = await download.path()
  expect(path).toBeTruthy()
  await page.getByLabel('匯入備份').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":3}'),
  })
  await expect(page.getByRole('alert')).toContainText('備份版本或格式不正確')
  await page.getByLabel('匯入備份').setInputFiles(path!)
  await page.getByRole('dialog').getByRole('button', { name: '匯入', exact: true }).click()
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(1)
})

test('quick add follows calendar date and supports inline category and exercise creation', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '2026-11-18', exact: true }).click()
  const dialog = await add(page)
  await expect(dialog.getByLabel('日期', { exact: true })).toHaveValue('2026-11-18')
  await dialog.getByRole('button', { name: '新增分類', exact: true }).click()
  await dialog.getByLabel('分類名稱').fill('自訂部位')
  await dialog.getByRole('button', { name: '新增', exact: true }).click()
  await dialog.getByRole('button', { name: '新增動作', exact: true }).click()
  await dialog.getByLabel('動作名稱').fill('自訂動作')
  await dialog.getByRole('button', { name: '新增', exact: true }).click()
  await dialog.getByRole('button', { name: '總重', exact: true }).click()
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  const card = page.getByTestId('workout-card')
  await expect(card).toContainText('自訂部位')
  await expect(card).toContainText('自訂動作')
  await expect(card).toContainText('總重 10 kg')
  await page.screenshot({ path: info.outputPath('recorded-calendar.png'), fullPage: true })
})

test('dialog traps keyboard focus, closes with Escape and returns focus', async ({ page }) => {
  const dialog = await add(page)
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '快速紀錄' })).toBeFocused()
})

test('unreadable storage is not overwritten by adding a new record', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('fitness-log:v1', 'invalid data'))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('本機資料無法讀取')
  const dialog = await add(page)
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('請先匯出原始資料')
  expect(await page.evaluate(() => localStorage.getItem('fitness-log:v1'))).toBe('invalid data')
  await dialog.getByRole('button', { name: '關閉', exact: true }).click()
})

test('card clicks toggle Done while menu actions leave completion unchanged', async ({ page }) => {
  const dialog = await add(page)
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  const card = page.getByTestId('workout-card')
  const state = card.getByRole('button', { name: /^完成 / })
  await card.getByRole('heading', { name: '啞鈴臥推' }).click()
  await expect(state).toHaveAttribute('aria-pressed', 'false')
  await card.getByText('左右各 10 kg', { exact: false }).click()
  await expect(state).toHaveAttribute('aria-pressed', 'true')
  const size = (await card.boundingBox())!
  await card.click({ position: { x: size.width / 2, y: size.height - 6 } })
  await expect(state).toHaveAttribute('aria-pressed', 'false')
  await card.getByRole('button', { name: '啞鈴臥推選單' }).click()
  await expect(state).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click()
  await expect(state).toHaveAttribute('aria-pressed', 'false')
  await state.click()
  await expect(state).toHaveAttribute('aria-pressed', 'true')
  await state.focus()
  await page.keyboard.press('Space')
  await expect(state).toHaveAttribute('aria-pressed', 'false')
})
