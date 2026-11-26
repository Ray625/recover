/// <reference lib="dom" />
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import type { FitnessData } from '../../src/domain/fitness'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
function user(id: string) {
  return {
    id,
    email: id === A ? 'a@example.test' : 'b@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
  }
}
function session(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: id, exp, role: 'authenticated' }, 'signature']
    .map((v) => (typeof v === 'string' ? v : Buffer.from(JSON.stringify(v)).toString('base64url')))
    .join('.')
  return {
    access_token: token,
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    expires_at: exp,
    token_type: 'bearer',
    user: user(id),
  }
}
function actor(header: string | undefined) {
  try {
    return JSON.parse(Buffer.from((header ?? '').split('.')[1] ?? '', 'base64url').toString())
      .sub as string
  } catch {
    return ''
  }
}
function backend() {
  return {
    offline: false,
    documents: new Map<string, { data: FitnessData; revision: number }>(),
    writes: 0,
    dropAcknowledgements: 0,
    holdNextSave: null as null | Promise<void>,
  }
}
async function mock(context: BrowserContext, state: ReturnType<typeof backend>) {
  await context.route('https://fitness-test.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'content-type': 'application/json',
    }
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, body: JSON.stringify(body) })
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON()
      if (body.password === 'wrong')
        return respond(
          {
            code: 'invalid_credentials',
            error_code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          },
          400,
        )
      return respond(session(body.email === 'b@example.test' ? B : A))
    }
    if (url.pathname === '/auth/v1/logout') return respond({})
    if (url.pathname === '/auth/v1/user')
      return respond(user(actor(request.headers().authorization)))
    if (url.pathname === '/auth/v1/signup') return respond({ user: user(A), session: null })
    if (url.pathname === '/auth/v1/recover') return respond({})
    if (url.pathname.startsWith('/rest/')) {
      if (state.offline) return route.abort('internetdisconnected')
      const id = actor(request.headers().authorization)
      if (![A, B].includes(id)) return respond({ message: 'Unauthorized' }, 401)
      if (url.pathname === '/rest/v1/fitness_documents') {
        const doc = state.documents.get(id)
        return respond(doc ? [doc] : [])
      }
      if (url.pathname === '/rest/v1/rpc/save_fitness_document') {
        const body = request.postDataJSON()
        const previous = state.documents.get(id)
        if ((previous?.revision ?? 0) !== body.p_expected_revision)
          return respond({ code: '40001', message: 'Sync conflict' }, 409)
        const next = { data: structuredClone(body.p_data), revision: (previous?.revision ?? 0) + 1 }
        state.documents.set(id, next)
        state.writes++
        const gate = state.holdNextSave
        state.holdNextSave = null
        if (gate) await gate
        if (state.dropAcknowledgements > 0) {
          state.dropAcknowledgements--
          return route.abort('internetdisconnected')
        }
        return respond(next)
      }
    }
    return respond({ message: 'Unexpected request' }, 404)
  })
}
async function login(page: Page, email = 'a@example.test') {
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('密碼', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('status', { name: '' }).filter({ hasText: /已同步|尚無雲端紀錄/ }),
  ).toBeVisible()
}
async function add(page: Page) {
  await page.getByRole('button', { name: '快速紀錄' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click()
}

test.beforeEach(({ page }) => {
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') await dialog.accept()
    else await dialog.dismiss()
  })
})

test('guest import is explicit, repeatable without duplicates, and accounts stay isolated', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await add(page)
  const guest = await page.evaluate(() => localStorage.getItem('fitness-log:v1'))
  await login(page)
  expect(state.writes).toBe(0)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(0)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await page.getByRole('button', { name: '匯入本機紀錄' }).click()
  expect(state.writes).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: '確認', exact: true }).click()
  await expect.poll(() => state.documents.get(A)?.data.workouts.length).toBe(1)
  await page.getByRole('button', { name: '匯入本機紀錄' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '確認', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已同步' })).toBeVisible()
  expect(state.documents.get(A)?.data.workouts.length).toBe(1)
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await expect(page.getByRole('button', { name: '登入', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fitness-log:v1'))).toBe(guest)
  await login(page, 'b@example.test')
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(0)
  expect(state.documents.get(B)).toBeUndefined()
})

test('offline account edits survive reload and sync to a second device', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  state.offline = true
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await page.reload()
  await expect(page.getByTestId('workout-card')).toHaveCount(1)
  const guest = await page.evaluate(() => localStorage.getItem('fitness-log:v1'))
  expect(guest).toBeNull()
  state.offline = false
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await page.getByRole('button', { name: '同步', exact: true }).click()
  await expect.poll(() => state.documents.get(A)?.data.workouts.length).toBe(1)
  const second = await browser.newContext({ baseURL })
  try {
    await mock(second, state)
    const authSession = await page.evaluate(() => localStorage.getItem('liftlog:auth'))
    await second.addInitScript((value) => localStorage.setItem('liftlog:auth', value!), authSession)
    const other = await second.newPage()
    await other.goto('/')
    await expect(other.getByTestId('workout-card')).toHaveCount(1)
    await other
      .getByTestId('workout-card')
      .getByRole('button', { name: /^完成 / })
      .click()
    await expect.poll(() => state.documents.get(A)?.data.workouts[0]?.completed).toBe(false)
    await page.getByRole('button', { name: '同步', exact: true }).click()
    await page.getByRole('link', { name: '日曆', exact: true }).click()
    await expect(
      page.getByTestId('workout-card').getByRole('button', { name: /^完成 / }),
    ).toHaveAttribute('aria-pressed', 'false')
  } finally {
    await second.close()
  }
})

test('stale device cannot overwrite a newer cloud document and recovery keeps a backup', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await expect.poll(() => state.documents.get(A)?.revision).toBe(1)
  const remote = state.documents.get(A)!
  remote.revision = 2
  remote.data.workouts[0]!.weight = 50
  await add(page)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '版本衝突' })).toBeVisible()
  expect(state.documents.get(A)?.revision).toBe(2)
  expect(state.documents.get(A)?.data.workouts).toHaveLength(1)
  await page.getByRole('button', { name: '載入雲端版本' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '確認', exact: true }).click()
  await expect(page.getByRole('button', { name: '匯出同步前備份' })).toBeVisible()
  const backup = await page.evaluate(() =>
    localStorage.getItem('fitness-log:v1:account:11111111-1111-4111-8111-111111111111:recovery'),
  )
  expect(JSON.parse(backup!).workouts).toHaveLength(2)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(1)
  await expect(page.getByTestId('workout-card')).toContainText('50 kg')
})

test('invalid login stays signed out and password reset can be requested', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/#/account')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('密碼', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email 或密碼不正確')
  await page.getByRole('button', { name: '忘記密碼' }).click()
  await page.getByRole('button', { name: '寄送重設連結' }).click()
  await expect(page.getByRole('status')).toContainText('若帳戶存在')
  expect(state.writes).toBe(0)
})

test('pending account edits survive logout without leaking into the next account', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  state.offline = true
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '確認', exact: true }).click()
  await expect(page.getByRole('button', { name: '登入', exact: true })).toBeVisible()
  state.offline = false
  await login(page, 'b@example.test')
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(page.getByTestId('workout-card')).toHaveCount(0)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await login(page)
  await expect.poll(() => state.documents.get(A)?.data.workouts.length).toBe(1)
  expect(state.documents.get(B)).toBeUndefined()
})

test('another tab signing out closes an open account editor before it can save as guest', async ({
  page,
  context,
  baseURL,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  await page.getByRole('button', { name: '快速紀錄' }).click()
  await expect(page.getByRole('dialog', { name: '新增紀錄' })).toBeVisible()
  const other = await context.newPage()
  await other.goto(`${baseURL}/#/account`)
  await expect(other.getByText('a@example.test', { exact: true })).toBeVisible()
  await other.getByRole('button', { name: '登出', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '新增紀錄' })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('fitness-log:v1'))).toBeNull()
  await other.close()
})

test('automatic retry resumes after a network failure without pressing sync', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  state.offline = true
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('將自動重試')
  state.offline = false
  await expect.poll(() => state.documents.get(A)?.data.workouts.length, { timeout: 15000 }).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: '已同步' })).toBeVisible()
})

test('lost save response and edits during upload are reconciled without data loss', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  let release!: () => void
  state.holdNextSave = new Promise<void>((resolve) => {
    release = resolve
  })
  state.dropAcknowledgements = 1
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await expect.poll(() => state.writes).toBe(1)
  const record = page.getByTestId('workout-card')
  await record.getByRole('button', { name: /^完成 / }).click()
  const cache = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('fitness-log:v1:account:11111111-1111-4111-8111-111111111111')!,
    ),
  )
  expect(cache.dirty).toBe(true)
  expect(cache.pendingWrite.data.workouts[0].completed).toBe(true)
  expect(cache.data.workouts[0].completed).toBe(false)
  const remote = state.documents.get(A)!
  remote.data = {
    workouts: remote.data.workouts,
    exercises: remote.data.exercises,
    categories: remote.data.categories,
    version: 1,
  }
  release()
  await expect
    .poll(() => state.documents.get(A)?.data.workouts[0]?.completed, { timeout: 15000 })
    .toBe(false)
  expect(state.documents.get(A)?.data.workouts).toHaveLength(1)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已同步' })).toBeVisible()
  await expect(page.getByText('版本衝突', { exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await expect(record.getByRole('button', { name: /^完成 / })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('sync status and manual control stay on account page', async ({ page, context }) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await expect.poll(() => state.writes).toBe(1)
  await expect(page.getByRole('button', { name: '同步', exact: true })).toHaveCount(0)
  await expect(page.getByText('已同步', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '設定', exact: true }).click()
  await expect(page.getByRole('button', { name: '同步', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '帳戶', exact: true }).click()
  await expect(page.getByText('自動同步', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '同步', exact: true })).toBeVisible()
  await expect(page.getByText(/^最後同步：/)).toBeVisible()
})

test('cold device cannot write defaults until its cloud data has loaded', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await expect.poll(() => state.documents.get(A)?.revision).toBe(1)
  const authSession = await page.evaluate(() => localStorage.getItem('liftlog:auth'))
  const second = await browser.newContext({ baseURL })
  try {
    await mock(second, state)
    await second.addInitScript((value) => localStorage.setItem('liftlog:auth', value!), authSession)
    state.offline = true
    const other = await second.newPage()
    await other.goto('/#/account')
    await expect(other.getByRole('alert')).toContainText('將自動重試')
    await expect(other.getByRole('button', { name: '快速紀錄' })).toBeDisabled()
    state.offline = false
    await expect(other.getByRole('status').filter({ hasText: '已同步' })).toBeVisible({
      timeout: 15000,
    })
    await other.getByRole('link', { name: '日曆', exact: true }).click()
    await expect(other.getByTestId('workout-card')).toHaveCount(1)
    await expect(other.getByRole('button', { name: '快速紀錄' })).toBeEnabled()
    expect(state.documents.get(A)?.revision).toBe(1)
  } finally {
    await second.close()
  }
})

test('local storage failure keeps the editor draft and never uploads an unsaved change', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  await expect
    .poll(async () => {
      const cache = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('fitness-log:v1:account:11111111-1111-4111-8111-111111111111')!,
        ),
      )
      return cache?.dirty
    })
    .toBe(false)
  const writes = state.writes
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fitness-log:v1:account:11111111-1111-4111-8111-111111111111')
        throw new DOMException('Storage full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '啞鈴臥推選單' }).click()
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '編輯紀錄' })
  await dialog.getByLabel('重量(kg)', { exact: true }).fill('99')
  await dialog.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('儲存失敗')
  await expect(dialog.getByLabel('重量(kg)', { exact: true })).toHaveValue('99')
  expect(state.writes).toBe(writes)
  expect(state.documents.get(A)?.data.workouts[0]?.weight).toBe(10)
})

test('leaving with pending changes is protected until the upload is confirmed', async ({
  page,
  context,
}) => {
  const state = backend()
  await mock(context, state)
  await page.goto('/')
  await login(page)
  state.offline = true
  await page.getByRole('link', { name: '日曆', exact: true }).click()
  await add(page)
  const blocked = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(blocked).toBe(true)
  state.offline = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(async () => {
      const cache = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('fitness-log:v1:account:11111111-1111-4111-8111-111111111111')!,
        ),
      )
      return cache?.dirty
    })
    .toBe(false)
  const blockedAfterSync = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(blockedAfterSync).toBe(false)
})
