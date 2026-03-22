const { test, expect } = require('@playwright/test')

test('homepage renders and supports a simple interaction', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'API Server' })).toBeVisible()

  const details = page.locator('details')
  const summary = page.getByText('Show server status')

  await expect(details).not.toHaveAttribute('open', '')
  await expect(summary).toBeVisible()

  await summary.click()

  await expect(details).toHaveAttribute('open', '')
  await expect(page.getByText('API routes are available for automated tests.')).toBeVisible()
})
