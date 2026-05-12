/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({ useAuth: jest.fn() }))

const React = require('react')
const { render, screen, waitFor } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth } = require('@/components/providers')
const HomePage = require('@/app/page').default

const replace = jest.fn()

beforeEach(() => {
  replace.mockClear()
  useRouter.mockReturnValue({ replace })
})

describe('HomePage', () => {
  it('shows launch shell and does not navigate until auth is ready', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false })
    render(React.createElement(HomePage))
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByText('BudgetBuddy')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends authenticated users to the dashboard', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    render(React.createElement(HomePage))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
    expect(screen.getByText(/Setting up your calm money space/i)).toBeTruthy()
  })

  it('sends guests to login', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false })
    render(React.createElement(HomePage))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true')
  })
})
