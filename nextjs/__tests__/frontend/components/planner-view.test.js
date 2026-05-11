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
  apiDelete: jest.fn(),
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
  demoSavingsGoals: {
    goals: [],
    summary: {
      active_count: 0,
      current_total: '0.00',
      remaining_total: '0.00',
      monthly_required_total: '0.00',
      available_after_goal_contributions: null,
      pressure_level: 'none',
    },
  },
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryPresentation: jest.fn(({ name, icon, kind: _k = 'expense' }) => ({
    label: name == null || String(name).trim() === '' ? 'No cat' : name,
    color: '#123456',
    soft: '#abcdef',
    symbol: icon || (name?.[0] || '?'),
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
const { render, screen, waitFor, cleanup, act, fireEvent, within } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataChanged, useDataMode } = require('@/components/providers')
const { ApiError, apiDelete, apiGet, apiPost } = require('@/lib/apiClient')
const PlannerView = require('@/components/planner-view').default

let routerReplace

async function flushAsyncUpdates() {
  await Promise.resolve()
  await Promise.resolve()
}

async function renderPlanner(props = {}) {
  let result
  await act(async () => {
    result = render(React.createElement(PlannerView, props))
    await flushAsyncUpdates()
  })
  return result
}

beforeEach(() => {
  jest.clearAllMocks()
  routerReplace = jest.fn()
  useRouter.mockReturnValue({ replace: routerReplace })
  useAuth.mockReturnValue({
    isReady: true,
    logout: jest.fn(),
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
  const emptyGoalsSummaryPayload = {
    goals: [],
    summary: {
      active_count: 0,
      current_total: '0.00',
      remaining_total: '0.00',
      monthly_required_total: '0.00',
      available_after_goal_contributions: null,
      pressure_level: 'none',
    },
  }

  function mockPlannerResponses({ goalsPayload = null, failSummary = null } = {}) {
    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        category_budgets: [],
      })

    if (failSummary) {
      apiGet.mockRejectedValueOnce(failSummary)
    } else {
      apiGet.mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '200.00',
        total_income: '1200.00',
        remaining_budget: '800.00',
        threshold_exceeded: false,
        category_statuses: [],
      })
    }

    apiGet
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: null,
        category_budgets: [],
      })
      .mockResolvedValueOnce(goalsPayload ?? emptyGoalsSummaryPayload)
  }

  function mockFebruaryMonthFromQuery() {
    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: '800.00',
        category_budgets: [],
      })
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: '800.00',
        total_budget: '800.00',
        total_expenses: '120.00',
        total_income: '900.00',
        remaining_budget: '680.00',
        threshold_exceeded: false,
        category_statuses: [],
      })
      .mockResolvedValueOnce({
        month: '2026-01-01',
        monthly_limit: null,
        category_budgets: [],
      })
      .mockResolvedValueOnce(emptyGoalsSummaryPayload)
  }

  function mockFoodCatNoCap({ failSummary = null } = {}) {
    apiGet
      .mockResolvedValueOnce([{ id: 'cat-food', name: 'Food', icon: null }])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        category_budgets: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00' },
        ],
      })
    if (failSummary) {
      apiGet.mockRejectedValueOnce(failSummary)
    } else {
      apiGet.mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        total_budget: '120.00',
        total_expenses: '20.00',
        total_income: '1000.00',
        remaining_budget: '100.00',
        threshold_exceeded: false,
        category_statuses: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00', spent: '20.00' },
        ],
      })
    }
    apiGet
      .mockResolvedValueOnce({ month: '2026-02-01', monthly_limit: null, category_budgets: [] })
      .mockResolvedValueOnce(emptyGoalsSummaryPayload)
  }

  function mockCopyLastMonthLoad(prevMonthLimit = '850.00') {
    return [
      () => Promise.resolve([{ id: 'cat-food', name: 'Food', icon: null }]),
      () => Promise.resolve({ month: '2026-03-01', monthly_limit: null, category_budgets: [] }),
      () => Promise.resolve({
        month: '2026-03-01',
        monthly_limit: null,
        total_budget: '0.00',
        total_expenses: '0.00',
        total_income: '0.00',
        remaining_budget: '0.00',
        threshold_exceeded: false,
        category_statuses: [],
      }),
      () => Promise.resolve({ month: '2026-02-01', monthly_limit: prevMonthLimit, category_budgets: [] }),
      () => Promise.resolve(emptyGoalsSummaryPayload),
    ]
  }

  function makeRainyDayGoalPayload(goalId) {
    return {
      goals: [
        {
          id: goalId,
          name: 'Rainy day fund',
          icon: '\u{1F327}\uFE0F',
          target_amount: '500.00',
          current_amount: '100.00',
          remaining_amount: '400.00',
          target_date: '2026-12-31',
          archived: false,
          progress_percentage: 20,
          monthly_required: '41.67',
          budget_context: { status: 'ready', remaining_budget: '500.00', available_after_goal_contributions: '458.33' },
        },
      ],
      summary: {
        active_count: 1,
        current_total: '100.00',
        remaining_total: '400.00',
        monthly_required_total: '41.67',
        available_after_goal_contributions: '458.33',
        pressure_level: 'ready',
      },
    }
  }

  it('loads the default current month when opened without a month query', async () => {
    mockPlannerResponses()

    await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    expect(apiGet).toHaveBeenCalledWith(
      '/api/budget?month=2026-03-01',
      expect.objectContaining({ accessToken: 'test-token' })
    )
    expect(apiGet).toHaveBeenCalledWith(
      '/api/budget/summary?month=2026-03-01',
      expect.objectContaining({ accessToken: 'test-token' })
    )
    expect(routerReplace).not.toHaveBeenCalled()
    expect(screen.getByText('Selected month')).toBeTruthy()
    expect(screen.getAllByText('2026-03-01').length).toBeGreaterThan(0)
  })

  it.each(['2026-02', '2026-02-14'])(
    'normalizes month query %s to February start and clears the consumed query',
    async (initialMonth) => {
      mockFebruaryMonthFromQuery()

      await renderPlanner({ initialMonth })

      await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
      expect(apiGet).toHaveBeenCalledWith(
        '/api/budget?month=2026-02-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(apiGet).toHaveBeenCalledWith(
        '/api/budget/summary?month=2026-02-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(apiGet).toHaveBeenCalledWith(
        '/api/budget?month=2026-01-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(apiGet).toHaveBeenCalledWith(
        '/api/savings-goals?month=2026-02-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(routerReplace).toHaveBeenCalledWith('/planner', { scroll: false })
      expect(screen.getByText('Selected month')).toBeTruthy()
      expect(screen.getAllByText('2026-02-01').length).toBeGreaterThan(0)
    }
  )

  it.each(['2026-13', '2026-02-30'])(
    'falls back to the default month for invalid month query %s',
    async (initialMonth) => {
      mockPlannerResponses()

      await renderPlanner({ initialMonth })

      await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
      expect(apiGet).toHaveBeenCalledWith(
        '/api/budget?month=2026-03-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(apiGet).toHaveBeenCalledWith(
        '/api/savings-goals?month=2026-03-01',
        expect.objectContaining({ accessToken: 'test-token' })
      )
      expect(routerReplace).toHaveBeenCalledWith('/planner', { scroll: false })
      expect(screen.getAllByText('2026-03-01').length).toBeGreaterThan(0)
    }
  )

  it('refetches planner data when advancing to the next month in live mode', async () => {
    mockPlannerResponses()

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    const nextMonthButton = screen.getByRole('button', { name: /^Go to 2026-04-01$/ })
    await act(async () => {
      fireEvent.click(nextMonthButton)
      await flushAsyncUpdates()
    })

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(10))
    expect(screen.getByRole('button', { name: /^Go to 2026-05-01$/ })).toBeTruthy()
  })

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
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00', spent: '96.00', remaining_budget: '24.00', progress_percentage: 80 },
          { category_id: 'cat-fun', category_name: 'Fun', category_icon: null, monthly_limit: '120.00', spent: '96.00', remaining_budget: '24.00', progress_percentage: 80 },
        ],
      })
      .mockResolvedValueOnce({ month: '2026-02-01', monthly_limit: null, category_budgets: [] })
      .mockResolvedValueOnce({
        goals: [
          {
            id: 'goal-1',
            name: 'Emergency cushion',
            icon: '🛡️',
            target_amount: '1000.00',
            current_amount: '250.00',
            remaining_amount: '750.00',
            target_date: '2026-12-31',
            archived: false,
            progress_percentage: 25,
            monthly_required: '83.33',
            budget_context: { status: 'ready', remaining_budget: '800.00', available_after_goal_contributions: '716.67' },
          },
        ],
        summary: { active_count: 1, current_total: '250.00', remaining_total: '750.00', monthly_required_total: '83.33', available_after_goal_contributions: '716.67', pressure_level: 'ready' },
      })

    await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    expect(screen.getByText('Monthly budget health')).toBeTruthy()
    expect(screen.getAllByText('Near limit').length).toBeGreaterThan(0)
    expect(screen.getByText('$48.00 left')).toBeTruthy()
    expect(screen.getAllByText('No overall cap set').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0)
    expect(screen.getByText('Savings goals')).toBeTruthy()
    expect(screen.getByText('Emergency cushion')).toBeTruthy()
    const statusPill = screen.getByText('On track')
    expect(statusPill.className).toContain('savings-goal__status')
    expect(screen.getByText('\u{1F6E1}\uFE0F')).toBeTruthy()
  })

  it('shows a clear over-budget savings goal reason without remaining budget', async () => {
    mockPlannerResponses({
      goalsPayload: {
        goals: [
          {
            id: 'goal-1',
            name: 'Trip fund',
            icon: null,
            target_amount: '1200.00',
            current_amount: '200.00',
            remaining_amount: '1000.00',
            target_date: '2026-12-31',
            archived: false,
            progress_percentage: 16.67,
            monthly_required: '125.00',
            budget_context: { status: 'over_budget', remaining_budget: null },
          },
        ],
        summary: {
          active_count: 1,
          current_total: '200.00',
          remaining_total: '1000.00',
          monthly_required_total: '125.00',
          available_after_goal_contributions: null,
          pressure_level: 'over_budget',
        },
      },
    })

    await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    expect(screen.getByText('Over budget')).toBeTruthy()
    expect(screen.getByText('Needs $125.00/month without a clear remaining budget.')).toBeTruthy()
  })

  it('shows a partial-data notice and does not invent actuals when the live summary request fails', async () => {
    mockFoodCatNoCap({ failSummary: new Error('planner summary timed out') })

    await renderPlanner()

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(5)
    })

    expect(apiGet).toHaveBeenCalledWith(
      `/api/savings-goals?month=${encodeURIComponent('2026-03-01')}`,
      expect.objectContaining({ accessToken: 'test-token' })
    )
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

  it('clears one saved category plan immediately, recomputes summary totals, and does not refetch', async () => {
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
          { category_id: 'cat-fun', category_name: 'Fun', category_icon: null, monthly_limit: '80.00' },
        ],
      })
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: null,
        total_budget: '200.00',
        total_expenses: '50.00',
        total_income: '1000.00',
        remaining_budget: '150.00',
        threshold_exceeded: false,
        category_statuses: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '120.00', spent: '20.00' },
          { category_id: 'cat-fun', category_name: 'Fun', category_icon: null, monthly_limit: '80.00', spent: '30.00' },
        ],
      })
      .mockResolvedValueOnce({ month: '2026-02-01', monthly_limit: null, category_budgets: [] })
      .mockResolvedValueOnce(emptyGoalsSummaryPayload)
    apiDelete.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: null,
      notified: false,
      budget_alert: null,
      category_budgets: [
        { category_id: 'cat-fun', category_name: 'Fun', category_icon: null, monthly_limit: '80.00' },
      ],
    })

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    expect(screen.getByText('$150.00 left')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Clear plan' })[0])
      await flushAsyncUpdates()
    })

    expect(apiDelete).toHaveBeenCalledWith(
      '/api/budget?month=2026-03-01&category_id=cat-food',
      { accessToken: 'test-token' }
    )
    await waitFor(() => {
      expect(screen.getByText('Food plan cleared for 2026-03-01.')).toBeTruthy()
      expect(screen.getByText('Not set')).toBeTruthy()
    })
    expect(screen.getAllByDisplayValue('').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByDisplayValue('80.00')).toBeTruthy()
    expect(screen.queryByText('$150.00 left')).toBeNull()
    expect(screen.getByText('$30.00 left')).toBeTruthy()
    expect(screen.getByText('$30.00 under plan')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Clear plan' })).toHaveLength(1)
    expect(apiGet).toHaveBeenCalledTimes(5)
  })

  it('shows inline validation feedback for invalid category amount drafts', async () => {
    mockPlannerResponses()

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    const input = screen.getByLabelText('Plan amount ($)')
    await act(async () => {
      fireEvent.change(input, { target: { value: '-5' } })
      await flushAsyncUpdates()
    })
    expect(screen.getByText('Amount cannot be negative.')).toBeTruthy()

    await act(async () => {
      fireEvent.change(input, { target: { value: 'abc' } })
      await flushAsyncUpdates()
    })
    expect(screen.getByText('Enter a valid dollar amount.')).toBeTruthy()

    await act(async () => {
      fireEvent.change(input, { target: { value: '1.005' } })
      await flushAsyncUpdates()
    })
    const decimalMessage = screen.getByText('Enter a dollar amount with no more than 2 decimal places.')
    expect(decimalMessage).toBeTruthy()
    expect(decimalMessage.getAttribute('role')).toBe('status')
    expect(decimalMessage.getAttribute('aria-live')).toBe('polite')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(decimalMessage.id)

    await act(async () => {
      fireEvent.change(input, { target: { value: '0' } })
      await flushAsyncUpdates()
    })
    expect(screen.getByText('Enter an amount greater than $0.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save plan' }).disabled).toBe(true)
  })

  it('shows inline validation feedback for invalid overall cap drafts', async () => {
    mockPlannerResponses()

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    const input = screen.getByLabelText('Overall monthly cap')
    await act(async () => {
      fireEvent.change(input, { target: { value: '1.005' } })
      await flushAsyncUpdates()
    })

    const decimalMessage = screen.getByText('Enter a dollar amount with no more than 2 decimal places.')
    expect(decimalMessage).toBeTruthy()
    expect(decimalMessage.getAttribute('role')).toBe('status')
    expect(decimalMessage.getAttribute('aria-live')).toBe('polite')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(decimalMessage.id)
    expect(screen.getByRole('button', { name: 'Update cap' }).disabled).toBe(true)
  })

  it('points zero drafts on saved rows to the clear action', async () => {
    mockFoodCatNoCap()

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Plan amount ($)'), { target: { value: '0' } })
      await flushAsyncUpdates()
    })

    expect(screen.getByText('Use Clear plan to return this category to Not set.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save update' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Clear plan' }).disabled).toBe(false)
  })

  it('preserves positive decimal category budget saves', async () => {
    mockPlannerResponses()
    apiPost.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '1000.00',
      notified: false,
      budget_alert: null,
      category_budgets: [
        { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '49.23' },
      ],
    })

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        category_budgets: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '49.23' },
        ],
      })
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '200.00',
        total_income: '1200.00',
        remaining_budget: '800.00',
        threshold_exceeded: false,
        category_statuses: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '49.23', spent: '20.00' },
        ],
      })
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: null,
        category_budgets: [],
      })
      .mockResolvedValueOnce({
        goals: [],
        summary: {
          active_count: 0,
          current_total: '0.00',
          remaining_total: '0.00',
          monthly_required_total: '0.00',
          available_after_goal_contributions: null,
          pressure_level: 'none',
        },
      })

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Plan amount ($)'), { target: { value: '49.23' } })
      await flushAsyncUpdates()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
      await flushAsyncUpdates()
    })

    expect(apiPost).toHaveBeenCalledWith(
      '/api/budget',
      {
        month: '2026-03-01',
        category_budgets: [{ category_id: 'cat-food', monthly_limit: 49.23 }],
      },
      { accessToken: 'test-token' }
    )
    await waitFor(() => expect(screen.getByDisplayValue('49.23')).toBeTruthy())
  })

  it('surfaces partial availability when the budget summary request fails', async () => {
    mockPlannerResponses({ failSummary: new ApiError('Summary unavailable', { status: 503 }) })

    await renderPlanner()

    await waitFor(() => {
      expect(screen.getByText(/Some planner details are missing/i)).toBeTruthy()
    })
  })

  it('shows the server error message when updating the overall cap fails', async () => {
    mockPlannerResponses()
    apiPost.mockRejectedValueOnce(new Error('Planner sync interrupted'))

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Overall monthly cap'), { target: { value: '1100' } })
      await flushAsyncUpdates()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update cap' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(screen.getByText('Planner sync interrupted')).toBeTruthy()
    })
  })

  it('shows the generic planner message when overall cap save fails with a non-Error rejection', async () => {
    mockPlannerResponses()
    apiPost.mockRejectedValueOnce('tcp reset')

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Overall monthly cap'), { target: { value: '1100' } })
      await flushAsyncUpdates()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update cap' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(screen.getByText(/planner could not load this month right now/i)).toBeTruthy()
    })
  })

  it('disables the overall cap save while a category plan save is in flight', async () => {
    mockPlannerResponses()
    let resolveCategorySave
    apiPost.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCategorySave = resolve
    }))

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Overall monthly cap'), { target: { value: '1200' } })
      await flushAsyncUpdates()
    })
    expect(screen.getByRole('button', { name: 'Update cap' }).disabled).toBe(false)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Plan amount ($)'), { target: { value: '49.23' } })
      await flushAsyncUpdates()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByRole('button', { name: 'Update cap' }).disabled).toBe(true)

    await act(async () => {
      resolveCategorySave({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        notified: false,
        budget_alert: null,
        category_budgets: [
          { category_id: 'cat-food', category_name: 'Food', category_icon: null, monthly_limit: '49.23' },
        ],
      })
      await flushAsyncUpdates()
    })
  })

  it('toggles and cancels the inline Add goal form with a closing state', async () => {
    mockPlannerResponses()

    const { container } = await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    expect(screen.getByRole('button', { name: 'Add goal' }).getAttribute('aria-expanded')).toBe('false')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByRole('heading', { name: 'Add savings goal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose goal icon' })).toBeTruthy()
    expect(screen.getByLabelText('Goal name')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create goal' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Add goal' }).className).toContain('button-primary')
    expect(screen.getByRole('button', { name: 'Add goal' }).getAttribute('aria-expanded')).toBe('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    let closingShell = container.querySelector('.savings-goal-form-shell--closing')
    expect(closingShell).toBeTruthy()
    expect(closingShell.getAttribute('data-state')).toBe('closing')
    expect(container.querySelector('.savings-goal-form--closing')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add goal' }).getAttribute('aria-expanded')).toBe('true')

    await act(async () => {
      fireEvent.transitionEnd(closingShell, { propertyName: 'grid-template-rows' })
      await flushAsyncUpdates()
    })

    expect(screen.queryByRole('heading', { name: 'Add savings goal' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add goal' }).getAttribute('aria-expanded')).toBe('false')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Trip fund' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await flushAsyncUpdates()
    })

    const cancelClosingShell = container.querySelector('.savings-goal-form-shell--closing')
    expect(cancelClosingShell).toBeTruthy()
    await act(async () => {
      fireEvent.transitionEnd(cancelClosingShell, { propertyName: 'grid-template-rows' })
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByLabelText('Goal name').value).toBe('')
  })

  it('keeps the inline form open and preserves values when create fails', async () => {
    mockPlannerResponses()
    apiPost.mockRejectedValueOnce(new ApiError('Local database unavailable', 500))

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'New laptop' } })
      fireEvent.change(screen.getByLabelText('Target amount ($)'), { target: { value: '900' } })
      fireEvent.change(screen.getByLabelText('Current saved ($)'), { target: { value: '125' } })
      fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-11-30' } })
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose goal icon' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByRole('group', { name: 'Goal icons' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Use .* icon/ }).length).toBeGreaterThanOrEqual(24)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Laptop icon' }))
      await flushAsyncUpdates()
    })

    expect(screen.queryByRole('group', { name: 'Goal icons' })).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create goal' }))
      await flushAsyncUpdates()
    })

    expect(apiPost).toHaveBeenCalledWith(
      '/api/savings-goals',
      expect.objectContaining({
        name: 'New laptop',
        target_amount: 900,
        current_amount: 125,
        target_date: '2026-11-30',
        icon: '\u{1F4BB}',
      }),
      { accessToken: 'test-token' }
    )
    expect(screen.getByRole('heading', { name: 'Add savings goal' })).toBeTruthy()
    expect(screen.getAllByText('Local database unavailable').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Goal name').value).toBe('New laptop')
    expect(screen.getByLabelText('Target amount ($)').value).toBe('900')
    expect(screen.getByLabelText('Current saved ($)').value).toBe('125')
    expect(screen.getByLabelText('Target date').value).toBe('2026-11-30')
    expect(screen.getByRole('button', { name: 'Choose goal icon' }).textContent).toContain('\u{1F4BB}')
  })

  it('closes the goal icon picker from outside click and Escape', async () => {
    mockPlannerResponses()

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose goal icon' }))
      await flushAsyncUpdates()
    })
    expect(screen.getByRole('group', { name: 'Goal icons' })).toBeTruthy()

    await act(async () => {
      fireEvent.mouseDown(screen.getByLabelText('Goal name'))
      await flushAsyncUpdates()
    })
    expect(screen.queryByRole('group', { name: 'Goal icons' })).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose goal icon' }))
      await flushAsyncUpdates()
    })
    expect(screen.getByRole('group', { name: 'Goal icons' })).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
      await flushAsyncUpdates()
    })
    expect(screen.queryByRole('group', { name: 'Goal icons' })).toBeNull()
  })

  it('copies last month overall cap into the current month when the button is enabled', async () => {
    const notifyDataChanged = jest.fn()
    useDataChanged.mockReturnValue({ notifyDataChanged })
    const firstLoad = mockCopyLastMonthLoad('850.00')
    const repeatLoad = [...firstLoad, ...firstLoad]
    let loadIndex = 0
    apiGet.mockImplementation(() => {
      const fn = repeatLoad[loadIndex]
      loadIndex += 1
      return fn ? fn() : Promise.resolve([])
    })
    apiPost.mockResolvedValueOnce({ ok: true })

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy last month' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/budget',
        expect.objectContaining({ month: '2026-03-01', monthly_limit: 850 }),
        { accessToken: 'test-token' }
      )
    })
    expect(notifyDataChanged).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText(/Copied the 2026-02-01 plan into 2026-03-01/i)).toBeTruthy()
    })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(10))
  })

  it('shows feedback when copy last month fails with a non-auth API error', async () => {
    const firstLoad = mockCopyLastMonthLoad('200.00')
    let loadIndex = 0
    apiGet.mockImplementation(() => {
      const fn = firstLoad[loadIndex]
      loadIndex += 1
      return fn ? fn() : Promise.resolve([])
    })
    apiPost.mockRejectedValueOnce(new ApiError('Planner save failed', 503))

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy last month' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(screen.getByText(/Planner save failed/i)).toBeTruthy()
    })
  })

  it('archives a savings goal, refreshes planner data, and shows archived feedback', async () => {
    const goalsPayload = makeRainyDayGoalPayload('goal-arch-1')
    mockPlannerResponses({ goalsPayload })
    mockPlannerResponses({ goalsPayload })
    apiPost.mockResolvedValueOnce({ ok: true })

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    const goalCard = screen.getByText('Rainy day fund').closest('.savings-goal')
    await act(async () => {
      fireEvent.click(within(goalCard).getByRole('button', { name: 'Archive' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/savings-goals/archive',
        { goal_id: 'goal-arch-1' },
        { accessToken: 'test-token' }
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/Rainy day fund archived/i)).toBeTruthy()
    })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(10))
  })

  it('opens edit mode for a goal and posts updates to the savings goals update endpoint', async () => {
    const goalsPayload = makeRainyDayGoalPayload('goal-edit-1')
    mockPlannerResponses({ goalsPayload })
    mockPlannerResponses({ goalsPayload })
    apiPost.mockResolvedValueOnce({ ok: true })

    await renderPlanner()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))
    const goalCard = screen.getByText('Rainy day fund').closest('.savings-goal')
    await act(async () => {
      fireEvent.click(within(goalCard).getByRole('button', { name: 'Edit' }))
      await flushAsyncUpdates()
    })
    expect(screen.getByRole('heading', { name: 'Edit savings goal' })).toBeTruthy()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Rainy day fund v2' } })
      await flushAsyncUpdates()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/savings-goals/update',
        expect.objectContaining({
          goal_id: 'goal-edit-1',
          month: '2026-03-01',
          name: 'Rainy day fund v2',
        }),
        { accessToken: 'test-token' }
      )
    })
  })
})

describe('PlannerView (sample data)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({
      isReady: true,
      logout: jest.fn(),
      session: { accessToken: 'tok', user: { email: 'sam@example.com' } },
    })
    useDataChanged.mockReturnValue({ notifyDataChanged: jest.fn() })
    useDataMode.mockReturnValue({ isSampleMode: true })
  })

  it('hydrates the planner from demo payloads without live API calls', async () => {
    await renderPlanner()

    expect(apiGet).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeTruthy()
  })
})
