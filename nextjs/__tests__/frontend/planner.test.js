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
const { render, screen, waitFor, cleanup, act, fireEvent } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataChanged, useDataMode } = require('@/components/providers')
const { ApiError, apiGet, apiPost } = require('@/lib/apiClient')
const PlannerView = require('@/components/planner-view').default

async function flushAsyncUpdates() {
  await Promise.resolve()
  await Promise.resolve()
}

async function renderPlanner() {
  let result
  await act(async () => {
    result = render(React.createElement(PlannerView))
    await flushAsyncUpdates()
  })
  return result
}

beforeEach(() => {
  jest.clearAllMocks()
  useRouter.mockReturnValue({ replace: jest.fn() })
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
  function mockPlannerResponses({ goalsPayload = null } = {}) {
    apiGet
      .mockResolvedValueOnce([
        { id: 'cat-food', name: 'Food', icon: null },
      ])
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        category_budgets: [],
      })
      .mockResolvedValueOnce({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '200.00',
        total_income: '1200.00',
        remaining_budget: '800.00',
        threshold_exceeded: false,
        category_statuses: [],
      })
      .mockResolvedValueOnce({
        month: '2026-02-01',
        monthly_limit: null,
        category_budgets: [],
      })
      .mockResolvedValueOnce(goalsPayload ?? {
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
  }

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
        summary: {
          active_count: 1,
          current_total: '250.00',
          remaining_total: '750.00',
          monthly_required_total: '83.33',
          available_after_goal_contributions: '716.67',
          pressure_level: 'ready',
        },
      })

    await renderPlanner()

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(5)
    })

    expect(apiGet).toHaveBeenCalledWith(
      `/api/savings-goals?month=${encodeURIComponent('2026-03-01')}`,
      expect.objectContaining({ accessToken: 'test-token' })
    )
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
    expect(screen.getByText('Savings goals')).toBeTruthy()
    expect(screen.getByText('Emergency cushion')).toBeTruthy()
    const statusPill = screen.getByText('On track')
    expect(statusPill).toBeTruthy()
    expect(statusPill.className).toContain('savings-goal__status')
    expect(statusPill.closest('.savings-goal__top')).toBeTruthy()
    expect(screen.getByText('Monthly need fits your remaining budget.')).toBeTruthy()
    expect(screen.getByText('\u{1F6E1}\uFE0F')).toBeTruthy()
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

  it('opens the inline Add goal form from the savings goals CTA', async () => {
    mockPlannerResponses()

    await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByRole('heading', { name: 'Add savings goal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose goal icon' })).toBeTruthy()
    expect(screen.getByLabelText('Goal name')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create goal' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Add goal' }).className).toContain('button-primary')
  })

  it('toggles and cancels the inline Add goal form with a closing state', async () => {
    mockPlannerResponses()

    const { container } = await renderPlanner()

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(5))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    expect(screen.getByRole('heading', { name: 'Add savings goal' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    let closingShell = container.querySelector('.savings-goal-form-shell--closing')
    expect(closingShell).toBeTruthy()
    expect(closingShell.getAttribute('data-state')).toBe('closing')
    expect(container.querySelector('.savings-goal-form--closing')).toBeTruthy()

    await act(async () => {
      fireEvent.transitionEnd(closingShell, { propertyName: 'grid-template-rows' })
      await flushAsyncUpdates()
    })

    expect(screen.queryByRole('heading', { name: 'Add savings goal' })).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
      await flushAsyncUpdates()
    })

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Goal name'), { target: { value: 'Trip fund' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await flushAsyncUpdates()
    })

    closingShell = container.querySelector('.savings-goal-form-shell--closing')
    expect(closingShell).toBeTruthy()
    expect(container.querySelector('.savings-goal-form--closing')).toBeTruthy()

    await act(async () => {
      fireEvent.transitionEnd(closingShell, { propertyName: 'grid-template-rows' })
      await flushAsyncUpdates()
    })

    expect(screen.queryByRole('heading', { name: 'Add savings goal' })).toBeNull()

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

    expect(screen.getByRole('listbox', { name: 'Goal icons' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use Emergency icon' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use Medical icon' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use Wedding icon' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use Family icon' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use Holiday icon' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Use .* icon/ }).length).toBeGreaterThanOrEqual(24)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Laptop icon' }))
      await flushAsyncUpdates()
    })

    expect(screen.queryByRole('listbox', { name: 'Goal icons' })).toBeNull()

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
    expect(screen.getByRole('listbox', { name: 'Goal icons' })).toBeTruthy()

    await act(async () => {
      fireEvent.mouseDown(screen.getByLabelText('Goal name'))
      await flushAsyncUpdates()
    })
    expect(screen.queryByRole('listbox', { name: 'Goal icons' })).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose goal icon' }))
      await flushAsyncUpdates()
    })
    expect(screen.getByRole('listbox', { name: 'Goal icons' })).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
      await flushAsyncUpdates()
    })
    expect(screen.queryByRole('listbox', { name: 'Goal icons' })).toBeNull()
  })
})
