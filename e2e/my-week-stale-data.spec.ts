import { test, expect, type Page } from './fixtures/isolated-env'

/**
 * Tests that /my-week reflects plan/retro edits after navigating back.
 *
 * Bug: The my-week query had a 5-minute staleTime and content edits go through
 * Yjs WebSocket (no client-side mutation), so navigating back showed stale data.
 * Fix: staleTime set to 0 so every mount refetches fresh data from the API.
 */

type MyWeekApiResponse = {
  plan?: { id: string; items?: Array<{ text: string }> } | null
  retro?: { id: string; items?: Array<{ text: string }> } | null
}

async function fetchMyWeek(page: Page): Promise<MyWeekApiResponse> {
  const res = await page.request.get('/api/dashboard/my-week')
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<MyWeekApiResponse>
}

async function waitForDocumentContent(page: Page, documentId: string, text: string) {
  await expect.poll(async () => {
    const res = await page.request.get(`/api/documents/${documentId}`)
    if (!res.ok()) return false
    const doc = await res.json() as { content?: unknown }
    return JSON.stringify(doc.content ?? '').includes(text)
  }, { timeout: 45_000, intervals: [500, 1000, 2000] }).toBe(true)
}

async function waitForMyWeekItem(page: Page, text: string, field: 'plan' | 'retro') {
  await expect.poll(async () => {
    const res = await page.request.get('/api/dashboard/my-week')
    if (!res.ok()) return false
    const data = await res.json() as MyWeekApiResponse
    const doc = field === 'plan' ? data.plan : data.retro
    return doc?.items?.some((item) => item.text.includes(text)) ?? false
  }, { timeout: 45_000, intervals: [500, 1000, 2000] }).toBe(true)
}

async function openWeeklyPlanEditor(page: Page) {
  await page.goto('/my-week')
  await expect(page.getByRole('heading', { name: /^Week \d+$/ })).toBeVisible({ timeout: 10000 })

  const data = await fetchMyWeek(page)
  if (data.plan?.id) {
    await page.goto(`/documents/${data.plan.id}`)
  } else {
    const createBtn = page.getByRole('button', { name: /create plan for this week/i })
    await expect(createBtn).toBeVisible({ timeout: 10000 })
    await createBtn.click()
  }
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+/, { timeout: 10000 })
}

async function openWeeklyRetroEditor(page: Page) {
  await page.goto('/my-week')
  await expect(page.getByRole('heading', { name: /^Week \d+$/ })).toBeVisible({ timeout: 10000 })

  const data = await fetchMyWeek(page)
  if (data.retro?.id) {
    await page.goto(`/documents/${data.retro.id}`)
  } else {
    const createBtn = page.getByRole('button', { name: /create retro for this week/i })
    await expect(createBtn).toBeVisible({ timeout: 10000 })
    await createBtn.click()
  }
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+/, { timeout: 10000 })
}

async function typeInFirstBulletItem(page: Page, text: string) {
  const editor = page.locator('.ProseMirror').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  const firstItem = editor.locator('ul li p').first()
  await expect(firstItem).toBeVisible({ timeout: 15000 })
  await firstItem.click()
  await page.keyboard.type(text)
}

test.describe('My Week - stale data after editing plan/retro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill('dev@ship.local')
    await page.locator('#password').fill('admin123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL('/login', { timeout: 5000 })
  })

  test('plan edits are visible on /my-week after navigating back', async ({ page }) => {
    test.setTimeout(90_000)

    const planText = `Ship the new dashboard feature ${Date.now()}`
    await openWeeklyPlanEditor(page)
    const planId = page.url().match(/\/documents\/([a-f0-9-]+)/)?.[1]
    expect(planId).toBeTruthy()
    await typeInFirstBulletItem(page, planText)

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 })
    await waitForDocumentContent(page, planId!, planText)
    await waitForMyWeekItem(page, planText, 'plan')

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: /^Week \d+$/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(planText)).toBeVisible({ timeout: 15000 })
  })

  test('retro edits are visible on /my-week after navigating back', async ({ page }) => {
    test.setTimeout(90_000)

    const retroText = `Completed the API refactoring ${Date.now()}`
    await openWeeklyRetroEditor(page)
    const retroId = page.url().match(/\/documents\/([a-f0-9-]+)/)?.[1]
    expect(retroId).toBeTruthy()
    await typeInFirstBulletItem(page, retroText)

    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 })
    await waitForDocumentContent(page, retroId!, retroText)
    await waitForMyWeekItem(page, retroText, 'retro')

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: /^Week \d+$/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(retroText)).toBeVisible({ timeout: 15000 })
  })
})
