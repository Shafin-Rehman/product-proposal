/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => require('react').createElement('a', { href, ...props }, children),
}))
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
  demoActivity: [
    {
      id: 'demo-expense-1',
      kind: 'expense',
      merchant: 'Grocer',
      title: 'Grocer',
      chip: 'Food',
      occurredOn: '2026-03-12',
      amount: 82,
    },
    {
      id: 'demo-income-1',
      kind: 'income',
      title: 'Paycheck',
      chip: 'Income',
      occurredOn: '2026-03-10',
      amount: 2400,
    },
  ],
  demoBudgetSummary: {
    month: '2026-03-01',
    monthly_limit: '1000.00',
    total_budget: '1000.00',
    total_expenses: '820.00',
    total_income: '2400.00',
    remaining_budget: '180.00',
    threshold_exceeded: false,
    category_statuses: [
      {
        category_id: 'food',
        category_name: 'Food',
        monthly_limit: '350.00',
        spent: '320.00',
        remaining_budget: '30.00',
        progress_percentage: 91.43,
      },
      {
        category_id: 'fun',
        category_name: 'Fun',
        monthly_limit: '250.00',
        spent: '180.00',
        remaining_budget: '70.00',
        progress_percentage: 72,
      },
    ],
  },
  demoBudgetTrend: [240, 520, 820],
  demoCategoryBudgets: [
    { id: 'food', name: 'Food', budget: 350, spent: 320 },
    { id: 'fun', name: 'Fun', budget: 250, spent: 180 },
  ],
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn((value) => ({
    label: value,
    color: '#123456',
    soft: '#abcdef',
    symbol: value?.[0] || '?',
  })),
  getEntryVisual: jest.fn((entry) => ({
    color: entry.kind === 'income' ? '#0f9d58' : '#123456',
    soft: '#abcdef',
    symbol: entry.kind === 'income' ? '+' : '$',
  })),
  getInitialsLabel: jest.fn((value, fallback) => value?.slice(0, 2)?.toUpperCase() || fallback),
}))
jest.mock('@/lib/financeUtils', () => ({
  buildActivityFeed: jest.fn(),
  buildMonthlySpendTrend: jest.fn(),
  formatCurrency: jest.fn((value) => `$${value}`),
  formatMonthPeriod: jest.fn((value) => value),
  formatShortDate: jest.fn((value) => value),
  getCurrentMonthStart: jest.fn((date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`),
  isInMonth: jest.fn(),
}))

const React = require('react')
const { render, screen, waitFor, fireEvent, cleanup, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useDataChanged } = require('@/components/providers')
const { ApiError, apiGet, apiPost } = require('@/lib/apiClient')
const financeUtils = require('@/lib/financeUtils')
const {
  default: DashboardView,
  buildDerivedCategoryCards,
  getBudgetCtaLabel,
  getBudgetHintText,
  getBudgetHudModel,
  getBudgetPressureHighlight,
  getCategoryCards,
  getMonthProgressState,
} = require('@/components/dashboard-view')

function getMonthStartString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function createLocalDate(year, monthIndex, day, hour = 12, minute = 0, second = 0) {
  return new Date(year, monthIndex, day, hour, minute, second)
}

function createLiveSummary(overrides = {}) {
  return {
    month: TEST_CURRENT_MONTH,
    ...overrides,
  }
}

const TEST_NOW = createLocalDate(2026, 2, 21, 12)
const TEST_CURRENT_MONTH = getMonthStartString(TEST_NOW)
const TEST_NEXT_MONTH_DATE = createLocalDate(2026, 3, 21, 12)
const TEST_NEAR_BOUNDARY_CURRENT_MONTH_DATE = createLocalDate(2026, 2, 1, 0, 30)

async function flushAsyncUpdates() {
  await Promise.resolve()
  await Promise.resolve()
}

async function renderDashboard() {
  await act(async () => {
    render(React.createElement(DashboardView))
    await flushAsyncUpdates()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(TEST_NOW)
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
  useDataChanged.mockReturnValue({ dataChangedToken: 0 })
  financeUtils.buildActivityFeed.mockReturnValue([])
  financeUtils.buildMonthlySpendTrend.mockReturnValue([])
  financeUtils.getCurrentMonthStart.mockImplementation((date = new Date()) => getMonthStartString(date))
  financeUtils.isInMonth.mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe('getBudgetCtaLabel', () => {
  it('returns Set budget when no budgets exist', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [],
    })).toBe('Set budget')
  })

  it('returns Set overall limit when only category budgets exist', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: '75.00',
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: '75.00' },
      ],
    })).toBe('Set overall limit')
  })

  it('returns Set budget when category statuses only come from spending', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: null, spent: '75.00' },
      ],
    })).toBe('Set budget')
  })

  it('returns Edit budget when an overall monthly limit exists', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: '125.00',
      total_budget: '125.00',
    })).toBe('Edit budget')
  })
})

describe('getBudgetHintText', () => {
  it('explains that the sheet controls the overall monthly cap when no budgets exist', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [],
    })).toBe('Set an overall monthly limit here to control the monthly cap and overall-budget alerts.')
  })

  it('clarifies that category budgets already exist when there is no overall limit', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: '75.00',
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: '75.00' },
      ],
    })).toBe('Category budgets are already set. Add an overall monthly limit here to control the monthly cap and overall-budget alerts.')
  })

  it('does not claim category budgets already exist for spend-only statuses', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: null, spent: '75.00' },
      ],
    })).toBe('Set an overall monthly limit here to control the monthly cap and overall-budget alerts.')
  })

  it('shows the current overall monthly limit when one exists', () => {
    expect(getBudgetHintText({
      monthly_limit: '125.00',
      total_budget: '125.00',
    })).toBe('Current limit: $125.00. Changes take effect immediately.')
  })
})

describe('getCategoryCards', () => {
  it('falls back to derived expense cards when category statuses are unavailable', () => {
    expect(getCategoryCards(undefined, [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '30.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '20.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '50.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 50, progress: 50, note: '50% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 50, progress: 50, note: '50% of spend' }),
    ])
  })

  it('prefers summary category statuses when they are available', () => {
    expect(getCategoryCards([
      {
        category_id: 'cat-food',
        category_name: 'Food',
        category_icon: 'F',
        monthly_limit: '80.00',
        spent: '50.00',
        remaining_budget: '30.00',
        progress_percentage: 62.5,
      },
    ], [
      { id: 'e1', category_id: 'cat-other', category_name: 'Other', amount: '999.00' },
    ])).toEqual([
      expect.objectContaining({
        name: 'Food',
        amount: 50,
        progress: 62.5,
        note: '$30 left',
        statusLabel: 'On track',
        statusTone: 'positive',
      }),
    ])
  })

  it('falls back to derived expense cards when category statuses do not include real budgets', () => {
    expect(getCategoryCards([
      {
        category_id: 'cat-food',
        category_name: 'Food',
        category_icon: 'F',
        monthly_limit: null,
        spent: '50.00',
        remaining_budget: null,
        progress_percentage: 0,
      },
    ], [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '30.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '20.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '50.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 50, progress: 50, note: '50% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 50, progress: 50, note: '50% of spend' }),
    ])
  })
})

describe('buildDerivedCategoryCards', () => {
  it('groups live expenses by category and calculates share-based fallback cards', () => {
    const cards = buildDerivedCategoryCards([
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '25.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '15.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '10.00' },
    ])

    expect(cards).toEqual([
      expect.objectContaining({ name: 'Food', amount: 40, progress: 80, note: '80% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 10, progress: 20, note: '20% of spend' }),
    ])
    expect(cards[0]).not.toHaveProperty('statusLabel')
    expect(cards[0]).not.toHaveProperty('statusTone')
  })
})

describe('getMonthProgressState', () => {
  it('returns a safe empty state when the month value is invalid', () => {
    expect(getMonthProgressState('not-a-month')).toEqual({
      monthLength: 0,
      activeDay: 0,
      daysRemaining: 0,
      isCurrentMonth: false,
    })

    expect(getMonthProgressState('2026-13-01')).toEqual({
      monthLength: 0,
      activeDay: 0,
      daysRemaining: 0,
      isCurrentMonth: false,
    })

    expect(getMonthProgressState('2026-02-30')).toEqual({
      monthLength: 0,
      activeDay: 0,
      daysRemaining: 0,
      isCurrentMonth: false,
    })
  })

  it('uses the current local date for live current-month days remaining', () => {
    expect(getMonthProgressState(TEST_CURRENT_MONTH, {
      observedDayCount: 3,
      referenceDate: TEST_NOW,
    })).toEqual({
      monthLength: 31,
      activeDay: 21,
      daysRemaining: 11,
      isCurrentMonth: true,
    })
  })

  it('falls back to observed dashboard trend days for sample or non-current months', () => {
    expect(getMonthProgressState(TEST_CURRENT_MONTH, {
      observedDayCount: 15,
      referenceDate: TEST_NEXT_MONTH_DATE,
    })).toEqual({
      monthLength: 31,
      activeDay: 15,
      daysRemaining: 17,
      isCurrentMonth: false,
    })
  })

  it('treats the local month as current near UTC month boundaries', () => {
    expect(getMonthProgressState(TEST_CURRENT_MONTH, {
      observedDayCount: 3,
      referenceDate: TEST_NEAR_BOUNDARY_CURRENT_MONTH_DATE,
    })).toEqual({
      monthLength: 31,
      activeDay: 1,
      daysRemaining: 31,
      isCurrentMonth: true,
    })
  })

  it('normalizes valid month dates before comparing against the current month', () => {
    expect(getMonthProgressState('2026-03-15', {
      observedDayCount: 3,
      referenceDate: TEST_NOW,
    })).toEqual({
      monthLength: 31,
      activeDay: 21,
      daysRemaining: 11,
      isCurrentMonth: true,
    })
  })

  it('falls back to the runtime current date when the provided referenceDate is invalid', () => {
    expect(getMonthProgressState(TEST_CURRENT_MONTH, {
      observedDayCount: 8,
      referenceDate: new Date('not-a-date'),
    })).toEqual({
      monthLength: 31,
      activeDay: 21,
      daysRemaining: 11,
      isCurrentMonth: true,
    })

    expect(getMonthProgressState('2026-04-01', {
      observedDayCount: 8,
      referenceDate: 'not-a-date',
    })).toEqual({
      monthLength: 30,
      activeDay: 8,
      daysRemaining: 23,
      isCurrentMonth: false,
    })

    expect(getMonthProgressState(TEST_CURRENT_MONTH, {
      observedDayCount: 8,
      referenceDate: 'not-a-date',
    })).toEqual({
      monthLength: 31,
      activeDay: 21,
      daysRemaining: 11,
      isCurrentMonth: true,
    })
  })
})

describe('getBudgetHudModel', () => {
  it('uses placeholder metric values while the live summary is still loading', () => {
    expect(getBudgetHudModel(null, {
      month: TEST_CURRENT_MONTH,
      observedDayCount: 0,
      referenceDate: createLocalDate(2026, 2, 10, 12),
    })).toEqual(expect.objectContaining({
      tone: 'neutral',
      badge: 'Waiting',
      value: 'Waiting on live totals',
      metrics: [
        expect.objectContaining({ label: 'Spent', value: '--' }),
        expect.objectContaining({ label: 'Days left', value: '22' }),
        expect.objectContaining({ label: 'Daily allowance', value: '--' }),
        expect.objectContaining({ label: 'Net this month', value: '--' }),
      ],
    }))
  })

  it('returns a no-budget HUD state when only live spend is available', () => {
    expect(getBudgetHudModel({
      month: TEST_CURRENT_MONTH,
      total_income: '1200.00',
      total_expenses: '450.00',
      total_budget: null,
      remaining_budget: null,
      threshold_exceeded: false,
    }, {
      month: TEST_CURRENT_MONTH,
      observedDayCount: 10,
      referenceDate: createLocalDate(2026, 2, 10, 12),
    })).toEqual(expect.objectContaining({
      tone: 'neutral',
      badge: 'No budget',
      value: '$450 spent',
      hasBudget: false,
      progressWidth: '0%',
      metrics: [
        expect.objectContaining({ label: 'Spent', value: '$450' }),
        expect.objectContaining({ label: 'Days left', value: '--' }),
        expect.objectContaining({ label: 'Daily allowance', value: '--' }),
        expect.objectContaining({ label: 'Net this month', value: '$750' }),
      ],
    }))
  })

  it('returns a near-limit HUD state at eighty percent used', () => {
    expect(getBudgetHudModel({
      month: TEST_CURRENT_MONTH,
      total_income: '2000.00',
      total_expenses: '800.00',
      total_budget: '1000.00',
      remaining_budget: '200.00',
      threshold_exceeded: false,
    }, {
      month: TEST_CURRENT_MONTH,
      observedDayCount: 20,
      referenceDate: createLocalDate(2026, 2, 20, 12),
    })).toEqual(expect.objectContaining({
      tone: 'warning',
      badge: 'Near limit',
      value: '$200 left',
      progressWidth: '80%',
      isNearLimit: true,
      daysRemaining: 12,
      dailyAllowance: 16.67,
    }))
  })

  it('returns an over-budget HUD state with a corrective daily allowance', () => {
    expect(getBudgetHudModel({
      month: TEST_CURRENT_MONTH,
      total_income: '900.00',
      total_expenses: '1100.00',
      total_budget: '1000.00',
      remaining_budget: '-100.00',
      threshold_exceeded: true,
    }, {
      month: TEST_CURRENT_MONTH,
      observedDayCount: 25,
      referenceDate: createLocalDate(2026, 2, 25, 12),
    })).toEqual(expect.objectContaining({
      tone: 'danger',
      badge: 'Over budget',
      value: '$100 over',
      isOverBudget: true,
      daysRemaining: 7,
      dailyAllowance: -14.29,
    }))
  })

  it('returns an on-track HUD state when budget pace is healthy', () => {
    expect(getBudgetHudModel({
      month: TEST_CURRENT_MONTH,
      total_income: '2500.00',
      total_expenses: '500.00',
      total_budget: '1200.00',
      remaining_budget: '700.00',
      threshold_exceeded: false,
    }, {
      month: TEST_CURRENT_MONTH,
      observedDayCount: 12,
      referenceDate: createLocalDate(2026, 2, 12, 12),
    })).toEqual(expect.objectContaining({
      tone: 'positive',
      badge: 'On track',
      value: '$700 left',
      progressWidth: '41.67%',
      isNearLimit: false,
      isOverBudget: false,
      dailyAllowance: 35,
    }))
  })
})

describe('getBudgetPressureHighlight', () => {
  it('prioritizes the strongest over-budget category', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [
        {
          category_id: 'cat-food',
          category_name: 'Food',
          monthly_limit: '100.00',
          spent: '140.00',
          remaining_budget: '-40.00',
          progress_percentage: 140,
        },
        {
          category_id: 'cat-fun',
          category_name: 'Fun',
          monthly_limit: '100.00',
          spent: '120.00',
          remaining_budget: '-20.00',
          progress_percentage: 120,
        },
      ],
    })).toEqual(expect.objectContaining({
      tone: 'danger',
      label: 'Strongest overspend',
      title: 'Food',
      detail: '$40 over budget right now.',
    }))
  })

  it('falls back to the top spend-share category when no category budgets exist', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [],
    }, [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '60.00' },
      { id: 'e2', category_id: 'cat-fun', category_name: 'Fun', amount: '40.00' },
    ])).toEqual(expect.objectContaining({
      tone: 'neutral',
      label: 'Top spend area',
      title: 'Food',
      detail: '60% of spend this month.',
    }))
  })

  it('shows the highest-pressure budget category even when it is not over budget yet', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [
        {
          category_id: 'cat-food',
          category_name: 'Food',
          monthly_limit: '100.00',
          spent: '92.00',
          remaining_budget: '8.00',
          progress_percentage: 92,
        },
        {
          category_id: 'cat-fun',
          category_name: 'Fun',
          monthly_limit: '100.00',
          spent: '75.00',
          remaining_budget: '25.00',
          progress_percentage: 75,
        },
      ],
    })).toEqual(expect.objectContaining({
      tone: 'warning',
      label: 'Top category pressure',
      title: 'Food',
      detail: '92% used with $8 left.',
    }))
  })

  it('returns a waiting message when neither budgets nor expenses are available', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [],
    }, [])).toEqual({
      key: 'waiting',
      tone: 'neutral',
      label: 'Category pressure',
      title: 'Waiting on categories',
      detail: 'Current-month category pressure will show once expenses land.',
    })
  })
})

describe('DashboardView', () => {
  it('returns nothing until auth readiness and session are available', async () => {
    useAuth.mockReturnValue({
      isReady: false,
      logout: jest.fn(),
      session: null,
    })

    await renderDashboard()

    expect(document.body.textContent).toBe('')
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('renders the sample dashboard HUD, chart, categories, and activity without calling live APIs', async () => {
    useDataMode.mockReturnValue({ isSampleMode: true })

    await renderDashboard()

    expect(apiGet).not.toHaveBeenCalled()
    expect(screen.getByText('Sample')).toBeTruthy()
    expect(screen.getByText(/budget HUD/i)).toBeTruthy()
    expect(screen.getByText('$180 left')).toBeTruthy()
    expect(screen.getAllByText('Near limit').length).toBeGreaterThan(0)
    expect(screen.getByText('Positive cash flow')).toBeTruthy()
    expect(screen.getByText('Top category pressure')).toBeTruthy()
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    expect(screen.getByText('Grocer')).toBeTruthy()
    expect(screen.getAllByText('Paycheck').length).toBeGreaterThan(0)
    expect(screen.getByText('$820 spent')).toBeTruthy()
  })

  it('fetches live dashboard data and renders the updated HUD state', async () => {
    apiGet
      .mockResolvedValueOnce(createLiveSummary({
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '860.00',
        total_income: '2200.00',
        remaining_budget: '140.00',
        threshold_exceeded: false,
        category_statuses: [
          {
            category_id: 'food',
            category_name: 'Food',
            monthly_limit: '300.00',
            spent: '285.00',
            remaining_budget: '15.00',
            progress_percentage: 95,
          },
        ],
      }))
      .mockResolvedValueOnce([
        { id: 'expense-1', date: '2026-03-11', category_name: 'Food', amount: '285.00' },
      ])
      .mockResolvedValueOnce([
        { id: 'income-1', date: '2026-03-02', source: 'Salary', amount: '2200.00' },
      ])
    financeUtils.buildMonthlySpendTrend.mockReturnValue([320, 610, 860])
    financeUtils.buildActivityFeed.mockReturnValue([
      { id: 'expense-1', kind: 'expense', merchant: 'Grocer', title: 'Grocer', chip: 'Food', occurredOn: '2026-03-11', amount: 285 },
      { id: 'income-1', kind: 'income', title: 'Paycheck', chip: 'Income', occurredOn: '2026-03-02', amount: 2200 },
    ])

    await renderDashboard()

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(3)
    })
    expect(apiGet).toHaveBeenNthCalledWith(
      1,
      `/api/budget/summary?month=${TEST_CURRENT_MONTH}`,
      expect.objectContaining({ accessToken: 'test-token', signal: expect.any(AbortSignal) })
    )
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.getAllByText('Near limit').length).toBeGreaterThan(0)
    expect(screen.getByText('$140 left')).toBeTruthy()
    expect(screen.getByText('Positive cash flow')).toBeTruthy()
    expect(screen.getByText('Top category pressure')).toBeTruthy()
    expect(screen.getByText('Grocer')).toBeTruthy()
    expect(screen.getAllByText('Paycheck').length).toBeGreaterThan(0)
  })

  it('renders unavailable budget state instead of no-budget when only the summary call fails', async () => {
    apiGet
      .mockRejectedValueOnce(new Error('summary unavailable'))
      .mockResolvedValueOnce([
        { id: 'expense-1', date: '2026-03-11', category_name: 'Food', amount: '285.00' },
      ])
      .mockResolvedValueOnce([
        { id: 'income-1', date: '2026-03-02', source: 'Salary', amount: '2200.00' },
      ])

    await renderDashboard()

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.queryByText('No budget')).toBeNull()
    expect(screen.queryByText('Unplanned spend')).toBeNull()
    expect(screen.getByText('Health unavailable')).toBeTruthy()
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    expect(screen.getByText('100% of spend')).toBeTruthy()
  })

  it('shows a partial-data notice when some live endpoints fail but others succeed', async () => {
    apiGet
      .mockResolvedValueOnce(createLiveSummary({
        monthly_limit: '900.00',
        total_budget: '900.00',
        total_expenses: '450.00',
        total_income: '1400.00',
        remaining_budget: '450.00',
        threshold_exceeded: false,
        category_statuses: [],
      }))
      .mockRejectedValueOnce(new Error('expenses unavailable'))
      .mockResolvedValueOnce([])

    await renderDashboard()

    expect(screen.getByText('Live data is limited right now')).toBeTruthy()
    expect(screen.getByText('Some live sections are missing for the moment, but the rest of the month is still visible.')).toBeTruthy()
    expect(screen.getByText('On track')).toBeTruthy()
  })

  it('surfaces the catch-all live error message when dashboard loading throws before settling', async () => {
    apiGet.mockImplementation(() => {
      throw new Error('Exploded dashboard request')
    })

    await renderDashboard()

    expect(screen.getByText('Live data is limited right now')).toBeTruthy()
    expect(screen.getByText('Exploded dashboard request')).toBeTruthy()
    expect(screen.getByText('Budget unavailable')).toBeTruthy()
  })

  it('logs out and redirects when a live dashboard request returns unauthorized', async () => {
    const handleAuthError = jest.fn().mockReturnValue(true)
    const replace = jest.fn()
    useAuth.mockReturnValue({
      isReady: true,
      handleAuthError,
      session: {
        accessToken: 'expired-token',
        user: { email: 'sam.tester@example.com' },
      },
    })
    useRouter.mockReturnValue({ replace })
    apiGet
      .mockRejectedValueOnce(new ApiError('Expired session', 401))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await renderDashboard()

    await waitFor(() => {
      expect(handleAuthError).toHaveBeenCalled()
    })
  })

  it('opens the budget sheet and saves a new monthly limit through the live dashboard flow', async () => {
    apiGet
      .mockResolvedValueOnce(createLiveSummary({
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '400.00',
        total_income: '1500.00',
        remaining_budget: '600.00',
        threshold_exceeded: false,
        category_statuses: [],
      }))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(createLiveSummary({
        monthly_limit: '3000.00',
        total_budget: '3000.00',
        total_expenses: '400.00',
        total_income: '1500.00',
        remaining_budget: '2600.00',
        threshold_exceeded: false,
        category_statuses: [],
      }))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    apiPost.mockResolvedValueOnce({})

    await renderDashboard()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit budget' }))
      await flushAsyncUpdates()
    })
    expect(screen.getByText(/Monthly spending limit for/i)).toBeTruthy()
    expect(screen.getAllByText(TEST_CURRENT_MONTH).length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3000' } })
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update budget' }))
      await flushAsyncUpdates()
    })

    expect(apiPost).toHaveBeenCalledWith(
      '/api/budget',
      { month: TEST_CURRENT_MONTH, monthly_limit: 3000 },
      { accessToken: 'test-token' }
    )
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(6)
    })
    expect(screen.queryByText(/Current limit:/)).toBeNull()
  })
})
