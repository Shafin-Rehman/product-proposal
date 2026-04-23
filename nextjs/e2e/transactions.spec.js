const { test, expect } = require('@playwright/test')

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
}

async function readCurrency(locator) {
  const text = await locator.innerText()
  return Number(text.replace(/[^0-9.-]/g, ''))
}

function getPlannerRow(page, categoryName) {
  return page.locator('.planner-row', {
    has: page.locator('.planner-row__copy', { hasText: categoryName }),
  }).first()
}

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

test('Planner: expense and category budget update budget health with cleanup', async ({ page }) => {
  const merchant = `PW Budget Health ${Math.random().toString(36).substring(2, 10)}`
  const expenseAmount = 23.45
  let categoryName = ''
  let originalBudget = ''
  let budgetNeedsRestore = false

  await page.getByRole('link', { name: /planner/i }).click()
  await expect(page).toHaveURL(/\/planner/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible({ timeout: 15_000 })

  const budgetedRow = page.locator('.planner-row', {
    has: page.getByRole('button', { name: 'Save update' }),
  }).first()
  await expect(budgetedRow).toBeVisible({ timeout: 15_000 })

  categoryName = (await budgetedRow.locator('.planner-row__copy strong').innerText()).trim()
  originalBudget = await budgetedRow.locator('input').inputValue()
  const originalActual = await readCurrency(
    budgetedRow.locator('.planner-row__metrics > div').nth(1).locator('strong')
  )
  expect(Number.isFinite(originalActual)).toBe(true)
  expect(Number(originalBudget)).toBeGreaterThan(0)

  try {
    await page.getByRole('link', { name: /transactions/i }).click()
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 })
    await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })

    await page.locator('[aria-label="Add transaction"]').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Amount').fill(expenseAmount.toFixed(2))
    await page.getByLabel('Merchant').fill(merchant)
    await page.getByLabel('Category').selectOption({ value: categoryName })
    await page.getByRole('dialog').getByRole('button', { name: 'Add transaction' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    const expenseRow = page.getByRole('button').filter({ hasText: merchant })
    await expect(expenseRow.first()).toBeVisible({ timeout: 10_000 })
    await expect(expenseRow.first()).toContainText(formatCurrency(expenseAmount))

    await page.getByRole('link', { name: /planner/i }).click()
    await expect(page).toHaveURL(/\/planner/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible({ timeout: 15_000 })

    const plannerRow = getPlannerRow(page, categoryName)
    await expect(plannerRow).toBeVisible({ timeout: 15_000 })

    const expectedActual = Number((originalActual + expenseAmount).toFixed(2))
    await expect(
      plannerRow.locator('.planner-row__metrics > div').nth(1).locator('strong')
    ).toHaveText(formatCurrency(expectedActual), { timeout: 15_000 })

    const newBudgetAmount = Number((Math.max(expectedActual - 1, 0.01)).toFixed(2))
    const expectedOverAmount = Number((expectedActual - newBudgetAmount).toFixed(2))

    await plannerRow.locator('input').fill(newBudgetAmount.toFixed(2))
    await plannerRow.getByRole('button', { name: 'Save update' }).click()
    budgetNeedsRestore = true

    await expect(plannerRow.getByRole('button', { name: 'Save update' })).toBeDisabled({ timeout: 15_000 })
    await expect(plannerRow).toContainText('Over budget', { timeout: 15_000 })
    await expect(plannerRow).toContainText(formatCurrency(newBudgetAmount))
    await expect(plannerRow).toContainText(`${formatCurrency(expectedOverAmount)} over`)
  } finally {
    if (budgetNeedsRestore && categoryName && originalBudget) {
      await page.goto('/planner')
      await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible({ timeout: 15_000 })
      const plannerRow = getPlannerRow(page, categoryName)
      await expect(plannerRow).toBeVisible({ timeout: 15_000 })
      await plannerRow.locator('input').fill(originalBudget)
      await plannerRow.getByRole('button', { name: 'Save update' }).click()
      await expect(plannerRow.getByRole('button', { name: 'Save update' })).toBeDisabled({ timeout: 15_000 })
    }

    await page.goto('/transactions')
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Loading activity')).toBeHidden({ timeout: 15_000 })

    const cleanupRow = page.getByRole('button').filter({ hasText: merchant })
    if (await cleanupRow.count()) {
      await cleanupRow.first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm delete' }).click()
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })
      await expect(cleanupRow.first()).toBeHidden({ timeout: 10_000 })
    }
  }
})

test('Dashboard: set monthly budget and verify limit', async ({ page }) => {
  const uniqueAmount = String(1000 + Math.floor(Math.random() * 8000))
  const formatted = formatCurrency(uniqueAmount)

  await expect(page.locator('.budget-hero')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /set budget|edit budget|set overall limit/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const originalBudget = await page.getByLabel('Monthly limit ($)').inputValue()
  await page.getByLabel('Monthly limit ($)').fill(uniqueAmount)
  await page.getByRole('dialog').getByRole('button', { name: /set budget|update budget|set overall limit/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

  // READ: verify the unique amount reflects on dashboard
  await expect(page.getByText(new RegExp(`of ${formatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} budgeted`))).toBeVisible({ timeout: 15_000 })

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
