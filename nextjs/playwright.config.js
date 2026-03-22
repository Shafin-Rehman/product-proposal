const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy',
      SUPABASE_URL: 'http://localhost',
      SUPABASE_ANON_KEY: 'dummy',
    },
  },
})
