jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => ({ buildBudgetSummary: jest.fn() }))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryPresentation: jest.fn(() => ({
    label: 'Category',
    color: '#445566',
    soft: 'rgba(120, 140, 160, 0.18)',
    symbol: 'C',
  })),
}))

const {
  buildBudgetHealth,
  buildCashFlowSeries,
  buildCategoryMovers,
  buildComparisonMetrics,
  buildDailySpendDetails,
  buildDailySpendSeries,
  buildInsightsSnapshot,
} = require('@/lib/insights')
const db = require('@/lib/db')
const { buildBudgetSummary } = require('@/lib/budget')

describe('insights specification', () => {
  describe('buildComparisonMetrics', () => {
    it('builds compact month-over-month metrics with the restored tones', () => {
      const metrics = buildComparisonMetrics(
        { total_income: '3229.00', total_expenses: '1011.36', total_budget: '2600.00', remaining_budget: '1588.64' },
        { total_income: '3010.00', total_expenses: '934.18', total_budget: '2600.00', remaining_budget: '1665.82' }
      )

      expect(metrics).toEqual([
        expect.objectContaining({ id: 'income', deltaTone: 'positive' }),
        expect.objectContaining({ id: 'expenses', deltaTone: 'warning' }),
        expect.objectContaining({ id: 'net', deltaTone: 'positive' }),
        expect.objectContaining({ id: 'budget-left', deltaTone: 'warning' }),
      ])
    })
  })

  describe('buildCategoryMovers', () => {
    it('keeps status labels aligned with the restored budget language', () => {
      const movers = buildCategoryMovers(
        [
          { category_id: 'shopping', category_name: 'Shopping', spent: '347.00', monthly_limit: '500.00', remaining_budget: '153.00', progress_percentage: 69.4 },
          { category_id: 'groceries', category_name: 'Groceries', spent: '289.00', monthly_limit: '360.00', remaining_budget: '71.00', progress_percentage: 80.28 },
        ],
        [
          { category_id: 'shopping', category_name: 'Shopping', spent: '271.00', monthly_limit: '500.00', remaining_budget: '229.00', progress_percentage: 54.2 },
          { category_id: 'groceries', category_name: 'Groceries', spent: '248.00', monthly_limit: '360.00', remaining_budget: '112.00', progress_percentage: 68.9 },
        ]
      )

      expect(movers).toEqual([
        expect.objectContaining({ id: 'shopping', statusLabel: 'Watch', tone: 'caution' }),
        expect.objectContaining({ id: 'groceries', statusLabel: 'Near limit', tone: 'warning' }),
      ])
    })
  })

  describe('buildBudgetHealth', () => {
    it('shows on track with 0% progress when nothing has been spent', () => {
      const health = buildBudgetHealth({
        total_budget: '1000.00',
        total_expenses: '0',
        remaining_budget: '1000.00',
        category_statuses: [],
      })

      expect(health.progressValue).toBe(0)
      expect(health.tone).toBe('positive')
      expect(health.statusLabel).toBe('On track')
    })

    it('shows over budget with 100% progress when spending hits the limit', () => {
      const health = buildBudgetHealth({
        total_budget: '1000.00',
        total_expenses: '1000.00',
        remaining_budget: '0',
        category_statuses: [],
      })

      expect(health.progressValue).toBe(100)
      expect(health.tone).toBe('danger')
      expect(health.statusLabel).toBe('Over budget')
    })

    it('returns pressure categories with On track, Watch, Near limit, and Over budget states', () => {
      const health = buildBudgetHealth({
        total_budget: '2600.00',
        total_expenses: '1011.36',
        remaining_budget: '1588.64',
        category_statuses: [
          { category_id: 'fun', category_name: 'Fun', spent: '94.56', monthly_limit: '180.00', remaining_budget: '85.44', progress_percentage: 52.53 },
          { category_id: 'shopping', category_name: 'Shopping', spent: '347.00', monthly_limit: '500.00', remaining_budget: '153.00', progress_percentage: 69.4 },
          { category_id: 'groceries', category_name: 'Groceries', spent: '289.00', monthly_limit: '360.00', remaining_budget: '71.00', progress_percentage: 80.28 },
          { category_id: 'rent', category_name: 'Rent', spent: '910.00', monthly_limit: '900.00', remaining_budget: '-10.00', progress_percentage: 101.1 },
        ],
      })

      expect(health.statusLabel).toBe('On track')
      expect(health.pressureCategories).toEqual([
        expect.objectContaining({ id: 'rent', statusLabel: 'Over budget', tone: 'danger' }),
        expect.objectContaining({ id: 'groceries', statusLabel: 'Near limit', tone: 'warning' }),
        expect.objectContaining({ id: 'shopping', statusLabel: 'Watch', tone: 'caution' }),
      ])
    })

    it('returns a neutral no-budget state when no monthly budget exists', () => {
      expect(buildBudgetHealth({ total_budget: null, total_expenses: '45.00', remaining_budget: null, category_statuses: [] })).toEqual(
        expect.objectContaining({ tone: 'neutral', statusLabel: 'No budget' })
      )
    })
  })

  describe('buildCashFlowSeries', () => {
    it('handles an empty month window without throwing', () => {
      const cashFlow = buildCashFlowSeries([], [], [])
      expect(cashFlow.series).toEqual([])
      expect(cashFlow.rangeLabel).toBeNull()
      expect(cashFlow.summary).toEqual(
        expect.objectContaining({ totalIncome: 0, totalExpenses: 0, totalNet: 0, averageNet: 0 })
      )
    })
  })

  describe('buildDailySpendDetails', () => {
    it('appends an ordinal when fallback rows collide on day, amount, title, and category', () => {
      const duplicate = {
        id: null,
        occurred_on: '2026-03-20',
        amount: '5.00',
        title: 'Snack',
        category_name: 'Food',
      }
      const details = buildDailySpendDetails([duplicate, { ...duplicate, id: null }])
      const ids = details.map((item) => item.id).sort()
      expect(ids[0]).toBe('daily-expense-fallback:2026-03-20:5:Snack:Food')
      expect(ids[1]).toBe('daily-expense-fallback:2026-03-20:5:Snack:Food:2')
    })

    it('preserves real expense ids from the database when present', () => {
      const details = buildDailySpendDetails([
        { id: 'exp-uuid-1', occurred_on: '2026-03-01', amount: '10', title: 'A', category_name: 'Cat' },
      ])
      expect(details[0].id).toBe('exp-uuid-1')
    })

    it('skips rows with no parseable date', () => {
      expect(buildDailySpendDetails([{ id: 'x', occurred_on: null, amount: '1', title: 'Nope', category_name: 'C' }])).toEqual([])
    })
  })

  describe('buildDailySpendSeries', () => {
    it('includes activeDayAverage for the restored rhythm view', () => {
      const daily = buildDailySpendSeries(
        [
          { day: '2026-03-18', total_spend: '18.50' },
          { day: '2026-03-21', total_spend: '89.50' },
          { day: '2026-03-22', total_spend: '147.00' },
        ],
        '2026-03-01'
      )

      expect(daily.activeDays).toBe(3)
      expect(daily.totalAmount).toBe(255)
      expect(daily.activeDayAverage).toBe(85)
      expect(daily.peakDay).toEqual(expect.objectContaining({ day: 22, amount: 147 }))
    })
  })

  describe('buildInsightsSnapshot savings goals', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('marks current-month past-due savings goals overdue', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-04-29T12:00:00Z'))
      buildBudgetSummary
        .mockResolvedValueOnce({
          month: '2026-04-01',
          total_budget: '1000.00',
          remaining_budget: '900.00',
          total_expenses: '100.00',
          total_income: '2000.00',
          category_statuses: [],
        })
        .mockResolvedValueOnce({
          month: '2026-03-01',
          total_budget: '1000.00',
          remaining_budget: '800.00',
          total_expenses: '200.00',
          total_income: '2000.00',
          category_statuses: [],
        })

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ earliest_date: '2026-04-01' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Conference fund',
              target_amount: '1000.00',
              current_amount: '100.00',
              target_date: '2026-04-10',
              archived: false,
              archived_at: null,
              created_at: '2026-04-01T00:00:00Z',
              updated_at: '2026-04-01T00:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })

      try {
        const snapshot = await buildInsightsSnapshot('uid', '2026-04-01')

        expect(snapshot.savingsGoals.goals[0].budget_context.status).toBe('overdue')
        expect(snapshot.savingsGoals.goals[0].months_remaining).toBe(1)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('buildInsightsSnapshot — upcomingRecurring', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      buildBudgetSummary.mockResolvedValue({
        total_expenses: '0', total_income: '0', monthly_limit: null,
        category_statuses: [], threshold_notified: false,
      })
    })

    function stubRecurring(rows) {
      db.query.mockImplementation((sql) => {
        if (sql.includes('recurring_rules')) return Promise.resolve({ rows })
        return Promise.resolve({ rows: [] })
      })
    }

    it('shows no upcoming recurring charges when none are scheduled', async () => {
      stubRecurring([])
      const snapshot = await buildInsightsSnapshot('uid', '2026-05-01')

      expect(snapshot.upcomingRecurring).toEqual([])
    })

    it('lists each upcoming expense charge with the fields the insights surface needs', async () => {
      stubRecurring([{
        id: 'r1', type: 'expense', description: 'Spotify', amount: '11.99',
        frequency: 'monthly', next_date: '2026-06-01',
        category_name: 'Entertainment', category_icon: null, source_name: null,
      }])
      const snapshot = await buildInsightsSnapshot('uid', '2026-05-01')
      const [item] = snapshot.upcomingRecurring
      expect(item.id).toBe('r1')
      expect(item.title).toBe('Spotify')
      expect(item.amount).toBe(11.99)
      expect(item.frequency).toBe('monthly')
      expect(item.nextDate).toBe('2026-06-01')
    })

    it('income rule has type: "income" in the snapshot item', async () => {
      stubRecurring([{
        id: 'r2', type: 'income', description: 'Salary', amount: '3000.00',
        frequency: 'monthly', next_date: '2026-06-01',
        category_name: null, category_icon: null, source_name: 'Employer',
      }])
      const snapshot = await buildInsightsSnapshot('uid', '2026-05-01')

      expect(snapshot.upcomingRecurring[0].type).toBe('income')
    })
  })
})
