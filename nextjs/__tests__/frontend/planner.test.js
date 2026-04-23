/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
  useDataChanged: jest.fn(),
}))
jest.mock('@/lib/apiClient', () => ({
  ApiError: class ApiError extends Error {
    constructor(message = 'API error', status) {
      super(message)
      this.status = status
    }
  },
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))
jest.mock('@/lib/demoData', () => ({
  DEMO_MONTH: '2026-03-01',
  demoBudgetSummary: {
    month: '2026-03-01',
    monthly_limit: '1000.00',
    total_budget: '1000.00',
    total_expenses: '720.00',
    total_income: '2400.00',
    remaining_budget: '280.00',
    threshold_exceeded: false,
    category_statuses: [],
  },
  demoCategoryBudgets: [],
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn((value) => ({
    label: value || 'Uncategorized',
    color: '#123456',
    soft: '#abcdef',
    symbol: value?.[0] || '?',
  })),
}))
jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => `$${Number(value ?? 0).toFixed(2)}`),
  formatMonthLabel: jest.fn((value) => value),
  formatMonthPeriod: jest.fn((value) => value),
  getCurrentMonthStart: jest.fn(() => '2026-03-01'),
  shiftMonth: jest.fn((month, offset) => {
    const [year, monthNumber] = String(month).split('-').map(Number)
    const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1, 12))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
  }),
}))

const React = require('react')
const { render, screen, waitFor, cleanup, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataChanged, useDataMode } = require('@/components/providers')
const { apiGet } = require('@/lib/apiClient')
const PlannerView = require('@/components/planner-view').default

async function flushAsyncUpdates() {
  await Promise.resolve()
  await Promise.resolve()
}

async function renderPlanner() {
  await act(async () => {
    render(React.createElement(PlannerView))
    await flushAsyncUpdates()
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  useRouter.mockReturnValue({ replace: jest.fn() })
  useAuth.mockReturnValue({
    isReady: true,
    handleAuthError: jest.fn(),
    session: {
      accessToken: 'test-token',
      user: { email: 'sam.tester@example.com' },
    },
  })
  useDataMode.mockReturnValue({ isSampleMode: false })
  useDataChanged.mockReturnValue({ notifyDataChanged: jest.fn() })
})

afterEach(() => {
  cleanup()
})

describe('PlannerView', () => {
  it('renders monthly health from category budgets when no explicit overall cap exists', async () => {
    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
        { id: 'cat-fun', name: 'Fun', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        category_budgets: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00' },
          { category_id: 'cat-fun', category_name: 'Fun', category_icon: null, monthly_limit: '120.00' },
        ],
      })
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        total_budget: '240.00',
        total_expenses: '192.00',
        total_income: '1000.00',
        remaining_budget: '48.00',
        threshold_exceeded: false,
        category_statuses: [
          {
            category_id: 'cat-food',
            category_name: 'Food',
            category_icon: null,
            monthly_limit: '120.00',
            spent: '96.00',
            remaining_budget: '24.00',
            progress_percentage: 80,
          },
          {
            category_id: 'cat-fun',
            category_name: 'Fun',
            category_icon: null,
            monthly_limit: '120.00',
            spent: '96.00',
            remaining_budget: '24.00',
            progress_percentage: 80,
          },
        ],
      })
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: null,
        category_budgets: [],
      })

    await renderPlanner()

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(4)
    })

    expect(screen.getByText('Monthly budget health')).toBeTruthy()
    expect(screen.getAllByText('Near limit').length).toBeGreaterThan(0)
    expect(screen.getByText('$48.00 left')).toBeTruthy()
    expect(screen.getByText('Financial health')).toBeTruthy()
    expect(screen.getByText('Positive cash flow')).toBeTruthy()
    expect(screen.getByText('$808.00 ahead')).toBeTruthy()
    expect(screen.getByText('Plan delta')).toBeTruthy()
    expect(screen.getByText('$48.00 under plan')).toBeTruthy()
    expect(screen.getAllByText('No overall cap set').length).toBeGreaterThan(0)
    expect(screen.getByText('Category progress')).toBeTruthy()
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
  })

  it('shows a partial-data notice and does not invent actuals when the live summary request fails', async () => {
    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        category_budgets: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00' },
        ],
      })
      .mockRejectedValueOnce(new Error('planner summary timed out'))
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: null,
        category_budgets: [],
      })

    await renderPlanner()

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(4)
    })

    expect(screen.getByText('Planner data is limited right now')).toBeTruthy()
    expect(screen.getByText('Some planner details are missing right now, but you can still review the rest of the month.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.getByText('Budget unavailable')).toBeTruthy()
    expect(screen.getByText('Health unavailable')).toBeTruthy()
    expect(screen.getByText('Actual spend unavailable')).toBeTruthy()
    expect(screen.getByText('Actual spend')).toBeTruthy()
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    expect(screen.getByText('Save update')).toBeTruthy()
  })
})
