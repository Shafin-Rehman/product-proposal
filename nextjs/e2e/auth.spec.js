const { test, expect } = require('@playwright/test')

test('user can sign in and reach the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('tester@gmail.com')
  await page.getByLabel('Password').fill('tester123')
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
  await expect(page.getByText('Recent activity')).toBeVisible()

  const activityFilter = page.locator('.dashboard-activity-filter')
  const incomeFilter = activityFilter.getByRole('button', { name: 'Income' })

  await expect(incomeFilter).toBeVisible()
  await incomeFilter.click()
  await expect(incomeFilter).toHaveAttribute('aria-pressed', 'true')
})
