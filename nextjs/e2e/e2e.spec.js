import { test, expect } from '@playwright/test'

test('home page loads and displays API Server heading', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await expect(page.getByRole('heading', { name: 'API Server' })).toBeVisible()
})

test('clicking Check Status button shows server is running message', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.getByRole('button', { name: 'Check Status' }).click()
  await expect(page.getByText('Server is running')).toBeVisible()
})