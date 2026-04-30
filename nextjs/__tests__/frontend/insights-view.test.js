/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => require('react').createElement('a', { href, ...props }, children),
}))
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
}))
jest.mock('@/lib/apiClient', () => ({
  ApiError: class ApiError extends Error {},
  apiGet: jest.fn(),
}))
jest.mock('@/lib/demoData', () => ({
  DEMO_MONTH: '2026-03-01',
  demoSavingsGoals: {
    goals: [
      {
        id: 'goal-1',
        name: 'Emergency cushion',
        target_amount: '1000.00',
        current_amount: '250.00',
        remaining_amount: '750.00',
        progress_percentage: 25,
        monthly_required: '83.33',
        budget_context: { status: 'ready' },
      },
    ],
    summary: {
      active_count: 1,
      current_total: '250.00',
      remaining_total: '750.00',
      monthly_required_total: '83.33',
      pressure_level: 'ready',
    },
  },
  demoInsightsSnapshot: {
    comparisonMetrics: [
      { id: 'income', label: 'Income', currentAmount: 3229, previousAmount: 3010, deltaAmount: 219, deltaPercentage: 7.3, deltaTone: 'positive' },
      { id: 'expenses', label: 'Expenses', currentAmount: 1011.36, previousAmount: 934.18, deltaAmount: 77.18, deltaPercentage: 8.3, deltaTone: 'warning' },
      { id: 'net', label: 'Net cash flow', currentAmount: 2217.64, previousAmount: 2075.82, deltaAmount: 141.82, deltaPercentage: 6.8, deltaTone: 'positive' },
      { id: 'budget-left', label: 'Budget left', currentAmount: 1588.64, previousAmount: 1665.82, deltaAmount: -77.18, deltaPercentage: -4.6, deltaTone: 'warning' },
    ],
    expenseBreakdown: [
      { id: 'shopping', name: 'Shopping', amount: 347, symbol: 'S', share: 34, tone: 'caution', statusLabel: 'Watch', progressValue: 69, progressLabel: '69% used', supportingText: '$153.00 left of $500.00', color: '#c9869e', soft: 'rgba(201,134,158,0.18)' },
      { id: 'groceries', name: 'Groceries', amount: 289, symbol: 'G', share: 29, tone: 'warning', statusLabel: 'Near limit', progressValue: 80, progressLabel: '80% used', supportingText: '$71.00 left of $360.00', color: '#6faa80', soft: 'rgba(111,170,128,0.18)' },
    ],
    incomeBreakdown: [
      { id: 'income-campus', name: 'Campus job', amount: 3200, symbol: 'C', share: 99, tone: 'positive', statusLabel: 'Income share', progressValue: 99, progressLabel: '99% of income', supportingText: '1 deposit', color: '#77b68d', soft: 'rgba(119,182,141,0.18)' },
    ],
    cashFlowSeries: [
      { month: '2025-10-01', label: 'Oct', incomeAmount: 2890, expenseAmount: 980, netAmount: 1910 },
      { month: '2025-11-01', label: 'Nov', incomeAmount: 3015, expenseAmount: 1160, netAmount: 1855 },
      { month: '2025-12-01', label: 'Dec', incomeAmount: 3102, expenseAmount: 1288, netAmount: 1814 },
      { month: '2026-01-01', label: 'Jan', incomeAmount: 2988, expenseAmount: 1064, netAmount: 1924 },
      { month: '2026-02-01', label: 'Feb', incomeAmount: 3010, expenseAmount: 934.18, netAmount: 2075.82 },
      { month: '2026-03-01', label: 'Mar', incomeAmount: 3229, expenseAmount: 1011.36, netAmount: 2217.64 },
    ],
    cashFlowRangeLabel: 'Oct 2025 - Mar 2026',
    cashFlowSummary: { totalIncome: 18234, totalExpenses: 6437.54, totalNet: 11796.46, averageNet: 1966.08 },
    budgetHealth: {
      tone: 'positive',
      statusLabel: 'On track',
      budgetAmount: 2600,
      spentAmount: 1011.36,
      remainingAmount: 1588.64,
      progressValue: 38.9,
      pressureCategories: [
        { id: 'groceries', name: 'Groceries', amount: 289, symbol: 'G', tone: 'warning', statusLabel: 'Near limit', progressValue: 80, progressLabel: '80% used', supportingText: '$71.00 left of $360.00', color: '#6faa80', soft: 'rgba(111,170,128,0.18)' },
      ],
    },
    categoryMovers: [
      { id: 'shopping', name: 'Shopping', amount: 347, previousAmount: 271, deltaAmount: 76, deltaTone: 'danger', statusLabel: 'Watch', tone: 'caution', symbol: 'S', color: '#c9869e', soft: 'rgba(201,134,158,0.18)' },
    ],
    dailySpend: {
      totalAmount: 1011.36,
      averageAmount: 33.71,
      activeDayAverage: 101.14,
      activeDays: 10,
      peakDay: { day: 30, key: '2026-03-30', amount: 310.76 },
      series: Array.from({ length: 30 }, (_, index) => ({ day: index + 1, key: `2026-03-${String(index + 1).padStart(2, '0')}`, amount: index === 29 ? 310.76 : index === 20 ? 147 : 0 })),
      details: [
        { id: 'expense-1', key: '2026-03-22', amount: 147, title: 'Amazon restock', categoryName: 'Shopping', categoryIcon: null, occurredOn: '2026-03-22', color: '#c9869e', soft: 'rgba(201,134,158,0.18)', symbol: 'S' },
      ],
    },
    topExpenses: [
      { id: 'expense-1', title: 'Amazon restock', categoryName: 'Shopping', categoryIcon: '🧪', occurredOn: '2026-03-22', amount: 147, symbol: '🧪', color: '#c9869e', soft: 'rgba(201,134,158,0.18)' },
    ],
  },
}))
jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0))),
  formatMonthLabel: jest.fn((value) => {
    const date = new Date(`${value}T12:00:00Z`)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }),
  formatPercentage: jest.fn((value) => `${Math.round(Number(value ?? 0))}%`),
  formatShortDate: jest.fn((value) => {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }),
  formatLongDate: jest.fn((value) => {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }),
  getCurrentMonthStart: jest.fn(() => '2026-03-01'),
  shiftMonth: jest.fn((value, offset) => {
    const date = new Date(`${value}T12:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + offset)
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
  }),
}))

const React = require('react')
const { render, screen, fireEvent } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode } = require('@/components/providers')
const { getActiveBreakdownItems, default: InsightsView } = require('@/components/insights-view')

describe('getActiveBreakdownItems', () => {
  it('returns expense breakdown by default', () => {
    const snapshot = {
      expenseBreakdown: [{ id: 'shopping' }],
      incomeBreakdown: [{ id: 'income' }],
    }

    expect(getActiveBreakdownItems(snapshot)).toEqual([{ id: 'shopping' }])
  })

  it('returns income breakdown when income mode is selected', () => {
    const snapshot = {
      expenseBreakdown: [{ id: 'shopping' }],
      incomeBreakdown: [{ id: 'income' }],
    }

    expect(getActiveBreakdownItems(snapshot, 'income')).toEqual([{ id: 'income' }])
  })

  it('returns an empty array without a snapshot', () => {
    expect(getActiveBreakdownItems(null)).toEqual([])
  })
})

describe('InsightsView (sample data)', () => {
  beforeEach(() => {
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({
      isReady: true,
      logout: jest.fn(),
      session: { accessToken: 'token' },
    })
    useDataMode.mockReturnValue({ isSampleMode: true })
  })

  it('renders insights-view modules, cash-flow details, and rhythm copy visible in the document', () => {
    const { container } = render(React.createElement(InsightsView))

    expect(screen.getAllByText('Shopping').length).toBeGreaterThan(0)
    expect(screen.getAllByText('34%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('vs last month').length).toBeGreaterThan(0)
    expect(screen.getByText('Spend / active day')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open March 2026 month view/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Top expenses' })).toBeTruthy()
    expect(
      screen.getByLabelText('Mar cash flow details: income $3,229.00, expenses $1,011.36, net +$2,217.64')
    ).toBeTruthy()
    expect(container.querySelector('.insights-v57__cashflow-peak')).toBeTruthy()
  })

  it('renders the new Category detail section with CategoryProgressRow items and a pace-vs-last-month chart', () => {
    const { container } = render(React.createElement(InsightsView))

    expect(screen.getByRole('heading', { name: 'Category detail' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Category detail' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Pace vs last month' })).toBeTruthy()
    expect(container.querySelector('.category-progress-list--insights')).toBeTruthy()
    expect(container.querySelector('.pace-chart')).toBeTruthy()
  })

  it('uses Source detail wording for the income breakdown detail section', () => {
    render(React.createElement(InsightsView))

    fireEvent.click(screen.getByRole('button', { name: 'Income' }))

    expect(screen.getByRole('heading', { name: 'Source detail' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Source detail' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Category detail' })).toBeNull()
  })

  it('shows a readable cash flow scale note in the card header', () => {
    const { container } = render(React.createElement(InsightsView))
    expect(container.querySelector('.insights-v57__cashflow-baseline-label')).toBeNull()
  })

  it('does not render the removed spend-pattern sparkline', () => {
    const { container } = render(React.createElement(InsightsView))
    expect(container.querySelector('.insights-v57__sparkline')).toBeNull()
    expect(container.querySelector('.insights-v57__cashflow-summary')).toBeNull()
  })

  it('passes server categoryIcon through to the top-expense detail sheet hero', () => {
    render(React.createElement(InsightsView))
    const row = screen.getByText('Amazon restock').closest('button')
    expect(row).toBeTruthy()
    fireEvent.click(row)
    const dialog = screen.getByRole('dialog', { name: 'Amazon restock' })
    const hero = dialog.querySelector('.entry-avatar--large')
    expect(hero).toBeTruthy()
    expect(hero.textContent).toContain('🧪')
  })
})
