const { test, expect } = require('@playwright/test')

test.describe('Authentication Stabilization', () => {
  test('user can sign in and reach the dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
    await expect(page.getByText('Tester')).toBeVisible()
  })

  test('unauthorized user is redirected from protected route', async ({ page }) => {
    // Start signed out
    await page.goto('/dashboard')
    
    // Should show the loading/redirecting shell
    await expect(page.getByText('One second')).toBeVisible()
    
    // Should end up at login
    await expect(page).toHaveURL(/\/login/)
  })

  test('user can log out cleanly', async ({ page }) => {
    // 1. Sign in
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // 2. Navigate to Account
    await page.goto('/account')
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
    
    // 3. Trigger Logout
    await page.getByRole('button', { name: 'Log out' }).click()

    // 4. Verify Redirect
    await expect(page).toHaveURL(/\/login/)

    // 5. Verify protected route is now inaccessible
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('expired session triggers redirect with notice', async ({ page }) => {
    // 1. Setup an authenticated state with a token that will fail
    await page.addInitScript(() => {
      window.localStorage.setItem('budgetbuddy.session', JSON.stringify({
        user: { name: 'Tester', email: 'tester@gmail.com' },
        accessToken: 'expired-token-123'
      }))
    })

    // 2. Mock the dashboard API to return 401
    await page.route('**/api/budget/summary**', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // 3. Visit dashboard
    await page.goto('/dashboard')

    // 4. Verify the app catches the 401 and redirects with the reason param
    await expect(page).toHaveURL(/\/login\?reason=expired/, { timeout: 10_000 })
    
    // 5. Verify the "Session expired" banner is visible
    await expect(page.getByText('Session expired')).toBeVisible()
    await expect(page.getByText('Your session has timed out')).toBeVisible()
  })

  test('invalid credentials show polished error message', async ({ page }) => {
    // 1. Mock the login API to return 401 with raw error
    await page.route('**/api/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid login credentials' }),
      });
    });

    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@email.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByText('Something needs attention')).toBeVisible()
    await expect(page.getByText("We couldn't find an account with those details")).toBeVisible()
    await expect(page.getByText('Invalid login credentials')).not.toBeVisible()
  })

  test('browser back button does not reveal protected content after logout', async ({ page }) => {
    // 1. Log in
    await page.goto('/login')
    await page.getByLabel('Email').fill('tester@gmail.com')
    await page.getByLabel('Password').fill('tester123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // 2. Log out
    await page.goto('/account')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login/)

    // 3. Press back
    await page.goBack()

    // 4. Should still be at login (or redirected back to it immediately)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Budgets' })).not.toBeVisible()
  })

  test('deep linking with malformed session clears state and redirects', async ({ page }) => {
    // 1. Set malformed/invalid session
    await page.addInitScript(() => {
      window.localStorage.setItem('budgetbuddy.session', 'not-a-json-string')
    })

    // 2. Visit a deep route
    await page.goto('/transactions')

    // 3. Should end up at login
    await expect(page).toHaveURL(/\/login/)
    
    // 4. LocalStorage should have been cleaned
    const session = await page.evaluate(() => window.localStorage.getItem('budgetbuddy.session'))
    expect(session).toBeNull()
  })
})
