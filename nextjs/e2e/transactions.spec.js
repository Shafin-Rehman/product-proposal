const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('tester@gmail.com')
  await page.getByLabel('Password').fill('tester123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
})

test('Transactions: navigation and MTA entry', async ({ page }) => {
  await page.getByRole('link', { name: /transactions/i }).click()
  await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 })
  await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })

  await page.locator('[aria-label="Add transaction"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const mtaMerchant = `MTA ${Math.random().toString(36).substring(2, 10)}`
  await page.getByLabel('Amount').fill('3.00')
  await page.getByLabel('Merchant').fill(mtaMerchant)
  await page.getByRole('dialog').getByRole('button', { name: 'Add transaction' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  const mtaRow = page.getByRole('button').filter({ hasText: mtaMerchant })
  await expect(mtaRow.first()).toBeVisible({ timeout: 10_000 })
  await expect(mtaRow.first()).toContainText('$3.00')

  await mtaRow.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
})

test('Transactions: add expense and verify amount', async ({ page }) => {
  await page.getByRole('link', { name: /transactions/i }).click()
  await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 })
  await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })

  await page.locator('[aria-label="Add transaction"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const merchant = `PW Test Cafe ${Math.random().toString(36).substring(2, 10)}`
  await page.getByLabel('Amount').fill('47.53')
  await page.getByLabel('Merchant').fill(merchant)

  await page.getByRole('dialog').getByRole('button', { name: 'Add transaction' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

  const row = page.getByRole('button').filter({ hasText: merchant })
  await expect(row.first()).toBeVisible({ timeout: 10_000 })
  await expect(row.first()).toContainText('$47.53')

  await row.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
  await expect(row.first()).toBeHidden({ timeout: 10_000 })
})

test('Dashboard: set monthly budget and verify limit', async ({ page }) => {
  const uniqueAmount = String(1000 + Math.floor(Math.random() * 8000))
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(uniqueAmount))

  await expect(page.locator('.budget-hero')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /set budget|edit budget|set overall limit/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const originalBudget = await page.getByLabel('Monthly limit ($)').inputValue()
  await page.getByLabel('Monthly limit ($)').fill(uniqueAmount)
  await page.getByRole('dialog').getByRole('button', { name: /set budget|update budget|set overall limit/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

  // READ: verify the unique amount reflects on dashboard
  await expect(page.getByText(`out of ${formatted} budgeted`)).toBeVisible({ timeout: 15_000 })

  if (originalBudget && Number(originalBudget) > 0) {
    await page.getByRole('button', { name: /set budget|edit budget|set overall limit/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Monthly limit ($)').fill(originalBudget)
    await page.getByRole('dialog').getByRole('button', { name: /set budget|update budget|set overall limit/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
  }
})

test('Dashboard: recent activity shows new transaction', async ({ page }) => {
  const entryName = `PW Dash ${Math.random().toString(36).substring(2, 10)}`

  await page.getByRole('link', { name: /transactions/i }).click()
  await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 })
  await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })

  await page.locator('[aria-label="Add transaction"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Amount').fill('66.40')
  await page.getByLabel('Merchant').fill(entryName)
  await page.getByRole('dialog').getByRole('button', { name: 'Add transaction' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

  const txRow = page.getByRole('button').filter({ hasText: entryName })
  await expect(txRow.first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('link', { name: /dashboard/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

  const activityPanel = page.locator('.dashboard-panel--activity')
  await expect(activityPanel).toBeVisible({ timeout: 15_000 })
  await expect(activityPanel).toContainText(entryName, { timeout: 10_000 })
  await expect(activityPanel).toContainText('$66.40')

  await page.getByRole('link', { name: /transactions/i }).click()
  await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 })
  await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })
  const cleanupRow = page.getByRole('button').filter({ hasText: entryName })
  await cleanupRow.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
})
