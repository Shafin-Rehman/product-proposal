const { test, expect } = require('@playwright/test')

test.describe('Authentication Flow Regression', () => {
  test('user can sign in and reach the dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    await expect(page.getByText('Tester')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
    await expect(page.getByText('Recent activity')).toBeVisible()
    await expect(page.getByText('Recent income')).toBeVisible()
  })

  test('Logout flow', async ({ page }) => {
    // Start authenticated
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // Navigate to account and trigger logout
    await page.getByRole('link', { name: 'Account' }).click()
    await page.getByRole('button', { name: 'Log out' }).click()

    // Verify redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Verify session state is cleared
    const sessionToken = await page.evaluate(() => window.localStorage.getItem('budgetbuddy.session'))
    expect(sessionToken).toBeNull()

    // Verify back button does not grant access
    await page.goBack()
    await expect(page).not.toHaveURL(/\/account/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('Signed-out access to protected route', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Verify protected content does not flash
    await expect(page.getByRole('heading', { name: 'Budgets' })).not.toBeVisible()

    // Verify redirect fallback to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('Protected route during auth loading', async ({ page }) => {
    // Authenticate first
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // Trigger SSR and first render loop
    page.evaluate(() => window.location.reload())

    // Verify stable loading UI appears immediately
    await expect(page.getByText('Loading your workspace...')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Budgets' })).not.toBeVisible()

    // Verify correct final result after loading settles
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()
    await expect(page.getByText('Loading your workspace...')).not.toBeVisible()
  })

  test('Expired/invalid session', async ({ page }) => {
    // Authenticate
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // Simulate expired session globally for all fetches
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Auth token expired' })
      })
    })

    // Trigger an API call by soft-navigating
    await page.getByRole('link', { name: 'Insights' }).click()

    // Verify clean redirect and query params
    await expect(page).toHaveURL(/\/login\?expired=true/)

    // Verify clean signed-out messaging with no loop
    await expect(page.getByText('Your session expired. Please log in again.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })
})
