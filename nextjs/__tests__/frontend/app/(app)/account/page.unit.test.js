/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn() })),
}))

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
  useTheme: jest.fn(),
}))

jest.mock('@/components/change-password-form', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'change-password-stub' }) }
})

jest.mock('@/components/change-email-form', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'change-email-stub' }) }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useTheme } = require('@/components/providers')
const AccountPage = require('@/app/(app)/account/page').default

beforeEach(() => {
  useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
  useAuth.mockReturnValue({
    user: { email: 'jane@example.com' },
    logout: jest.fn(),
    profileName: '',
    session: { accessToken: 'tok' },
    updateProfileName: jest.fn(),
    updateEmail: jest.fn(),
  })
  useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
  useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
})

it('account route (live) shows shell and security stubs', () => {
  render(React.createElement(AccountPage))
  expect(screen.getByText('Account settings')).toBeTruthy()
  expect(screen.getByTestId('change-password-stub')).toBeTruthy()
  expect(screen.getByTestId('change-email-stub')).toBeTruthy()
})

it('account route (demo) shows demo shell', () => {
  useAuth.mockReturnValue({
    user: {},
    logout: jest.fn(),
    profileName: '',
    session: null,
    updateProfileName: jest.fn(),
    updateEmail: jest.fn(),
  })
  useDataMode.mockReturnValue({ mode: 'sample', isSampleMode: true, setMode: jest.fn() })
  render(React.createElement(AccountPage))
  expect(screen.getByText('Demo mode')).toBeTruthy()
})
