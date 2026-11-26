/// <reference lib="dom" />
import { expect, test, type Locator } from '@playwright/test'

async function expectContained(dialog: Locator) {
  const geometry = await dialog.evaluate((el) => {
    const input = el.querySelector<HTMLInputElement>('input[type="date"]')!
    const body = el.querySelector<HTMLElement>('.fixed-modal__body')!
    const inputBox = input.getBoundingClientRect()
    const parentBox = input.parentElement!.getBoundingClientRect()
    const panelBox = el.querySelector('.fixed-modal__panel')!.getBoundingClientRect()
    return {
      inputLeft: inputBox.left,
      inputRight: inputBox.right,
      parentLeft: parentBox.left,
      parentRight: parentBox.right,
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      bodyWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
    }
  })
  expect(geometry.inputLeft).toBeGreaterThanOrEqual(geometry.parentLeft - 1)
  expect(geometry.inputRight).toBeLessThanOrEqual(geometry.parentRight + 1)
  expect(geometry.inputLeft).toBeGreaterThan(geometry.panelLeft)
  expect(geometry.inputRight).toBeLessThan(geometry.panelRight)
  expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.bodyWidth + 1)
}

for (const width of [320, 375, 393]) {
  test(`date field stays inside create and edit dialogs at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    await page.goto('/')
    await page.getByRole('button', { name: '快速紀錄' }).click()
    const create = page.getByRole('dialog', { name: '新增紀錄' })
    await create.getByLabel('日期', { exact: true }).fill('2026-12-28')
    await expectContained(create)
    await create.getByRole('button', { name: '儲存', exact: true }).click()
    await page.getByRole('button', { name: '啞鈴臥推選單' }).click()
    await page.getByRole('button', { name: '編輯', exact: true }).click()
    const edit = page.getByRole('dialog', { name: '編輯紀錄' })
    await expect(edit.getByLabel('日期', { exact: true })).toHaveValue('2026-12-28')
    await expectContained(edit)
    await page.screenshot({ path: info.outputPath('edit-date.png') })
    await edit.getByLabel('日期', { exact: true }).fill('2026-12-29')
    await edit.getByRole('button', { name: '儲存', exact: true }).click()
    await expect(page.getByRole('button', { name: '2026-12-29', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
}
