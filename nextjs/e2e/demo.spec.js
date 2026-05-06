const { test, expect } = require('@playwright/test')

test('demo flow: enter demo, see data, exit from account', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: /explore a demo first/i }).click()

  // Lands on dashboard (not stuck on login)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
  await expect(page.getByText('Recent activity')).toBeVisible()

  // Exit demo via account page
  await page.getByRole('link', { name: /account/i }).click()
  await expect(page).toHaveURL(/\/account/, { timeout: 5_000 })
  await page.getByRole('button', { name: /exit demo/i }).click()

  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

  await page.evaluate(() => {
    try { window.localStorage.removeItem('budgetbuddy.data-mode') } catch {}
  })
})

