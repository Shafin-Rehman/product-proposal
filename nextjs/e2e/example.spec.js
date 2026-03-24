const { test, expect } = require('@playwright/test')

test('Homepage loads and displays API Server heading', async ({ page }) => {
  await page.goto('/')

  // Expect a title "to contain" a substring.
  const heading = page.locator('h1')
  await expect(heading).toHaveText('API Server')
})
