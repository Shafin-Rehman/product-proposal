const {
  buildDashboardLivePaths,
  buildDemoRecentCashFlow,
  buildDerivedCategoryCards,
  buildSampleCategoryCards,
  getBudgetCtaLabel,
  getBudgetHintText,
  getBudgetHudModel,
  getBudgetPressureHighlight,
  getCategoryCards,
  getFirstName,
  getMonthProgressState,
  getPreviewCategories,
  getTopSavingsGoal,
  hasCategoryBudgets,
  hasOverallMonthlyLimit,
  mergeRowsById,
  sortRowsByDateDesc,
} = require('@/lib/dashboardModels')

describe('dashboardModels specification', () => {
  describe('mergeRowsById', () => {
    it('prefers later rows when duplicate ids are merged', () => {
      const older = { id: 'tx-1', amount: '10.00', label: 'older' }
      const newer = { id: 'tx-1', amount: '12.50', label: 'newer' }
      const unique = { id: 'tx-2', amount: '8.00', label: 'unique' }

      expect(mergeRowsById([older], [unique, newer])).toEqual([newer, unique])
    })
  })

  describe('sortRowsByDateDesc', () => {
    it('sorts rows by date descending without mutating the original list', () => {
      const oldest = { id: 'tx-1', date: '2026-03-01' }
      const newest = { id: 'tx-2', date: '2026-03-15' }
      const middle = { id: 'tx-3', date: '2026-03-07' }
      const rows = [oldest, newest, middle]

      expect(sortRowsByDateDesc(rows)).toEqual([newest, middle, oldest])
      expect(rows).toEqual([oldest, newest, middle])
    })

    it('keeps rows with equal or missing dates in their existing order', () => {
      const first = { id: 'tx-1' }
      const second = { id: 'tx-2' }
      const dated = { id: 'tx-3', created_at: '2026-03-08T10:00:00Z' }

      expect(sortRowsByDateDesc([first, dated, second])).toEqual([dated, first, second])
    })
  })

  describe('buildDashboardLivePaths', () => {
    it('bounds cash-flow transaction fetches to the displayed three-month window', () => {
      expect(buildDashboardLivePaths('2026-03-01')).toEqual({
        summary: '/api/budget/summary?month=2026-03-01',
        cashFlowExpenses: '/api/expenses?from=2026-01-01&to=2026-03-31',
        recentExpenses: '/api/expenses?limit=6',
        cashFlowIncome: '/api/income?from=2026-01-01&to=2026-03-31',
        recentIncome: '/api/income?limit=6',
        savingsGoals: '/api/savings-goals?month=2026-03-01',
      })
    })

    it('keeps recent activity limit-only while handling leap-year month ends', () => {
      const paths = buildDashboardLivePaths('2024-02-01', { activityLimit: 4 })

      expect(paths.cashFlowExpenses).toBe('/api/expenses?from=2023-12-01&to=2024-02-29')
      expect(paths.cashFlowIncome).toBe('/api/income?from=2023-12-01&to=2024-02-29')
      expect(paths.recentExpenses).toBe('/api/expenses?limit=4')
      expect(paths.recentIncome).toBe('/api/income?limit=4')
    })
  })

  describe('getFirstName', () => {
    it('returns a friendly default when email is missing', () => {
      expect(getFirstName('')).toBe('there')
    })

    it('title-cases the local part of an email', () => {
      expect(getFirstName('jane.doe@example.com')).toBe('Jane Doe')
    })
  })

  describe('buildDerivedCategoryCards', () => {
    it('aggregates amounts per category and assigns spend-share notes', () => {
      const cards = buildDerivedCategoryCards([
        { category_id: 'a', category_name: 'Food', amount: '10', category_icon: null },
        { category_id: 'a', category_name: 'Food', amount: '5', category_icon: '🍎' },
      ])
      expect(cards).toHaveLength(1)
      expect(cards[0].amount).toBe(15)
      expect(cards[0].note).toMatch(/% of spend/)
    })
  })

  describe('getBudgetPressureHighlight', () => {
    it('uses caller-supplied derived cards instead of recomputing from expenses', () => {
      const derived = [{
        id: 'd1',
        name: 'Dining',
        note: '40% of spend',
        progress: 40,
        amount: 40,
        symbol: 'D',
        color: '#111',
        soft: 'rgba(0,0,0,0.1)',
        monthlyLimit: null,
        remainingAmount: null,
      }]
      const highlight = getBudgetPressureHighlight({ category_statuses: [] }, [], derived)
      expect(highlight).toEqual(expect.objectContaining({
        key: 'top_spend_area',
        title: 'Dining',
      }))
    })
  })

  describe('budget copy helpers', () => {
    it('reflects overall limits, category plans, and empty states in CTA labels and hints', () => {
      expect(hasOverallMonthlyLimit({ monthly_limit: '500' })).toBe(true)
      expect(hasOverallMonthlyLimit({ monthly_limit: '0' })).toBe(false)
      expect(hasCategoryBudgets({ category_statuses: [{ monthly_limit: '10', spent: '0' }] })).toBe(true)
      expect(hasCategoryBudgets({ category_statuses: [{ monthly_limit: null, spent: '5' }] })).toBe(false)
      expect(getBudgetCtaLabel({ monthly_limit: '1', category_statuses: [] })).toBe('Edit budget')
      expect(getBudgetCtaLabel({ monthly_limit: null, category_statuses: [{ monthly_limit: '50', spent: '0' }] })).toBe('Set overall limit')
      expect(getBudgetCtaLabel({ monthly_limit: null, category_statuses: [] })).toBe('Set budget')
      expect(getBudgetHintText({ monthly_limit: '100.50' })).toContain('100.50')
      expect(getBudgetHintText({ monthly_limit: null, category_statuses: [{ monthly_limit: '50', spent: '0' }] }))
        .toContain('Category budgets are already set')
      expect(getBudgetHintText({})).toContain('Set an overall monthly limit')
    })
  })

  describe('getMonthProgressState', () => {
    it('returns a neutral progress envelope when the month string is not calendar-valid', () => {
      expect(getMonthProgressState('2026-13-01')).toEqual(expect.objectContaining({
        monthLength: 0,
        daysRemaining: 0,
        isCurrentMonth: false,
      }))
    })
  })

  describe('getBudgetHudModel', () => {
    it('surfaces loading placeholders until the summary snapshot is ready', () => {
      const model = getBudgetHudModel(null, {
        month: '2026-03-01',
        availability: 'loading',
        referenceDate: new Date('2026-03-10T12:00:00Z'),
      })
      expect(model.key).toBe('loading')
      expect(model.metrics[0].value).toBe('--')
    })

    it('binds currency metrics once an overall monthly limit is available', () => {
      const model = getBudgetHudModel({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        total_expenses: '250.00',
        total_income: '3000.00',
        category_statuses: [],
      }, { month: '2026-03-01', referenceDate: new Date('2026-03-15T12:00:00Z') })
      expect(model.hasBudget).toBe(true)
      expect(model.metrics[0].value).toMatch(/\$/)
      expect(model.net).toBeGreaterThan(0)
    })
  })

  describe('getCategoryCards', () => {
    it('prefers live category status rows when any category carries a monthly limit', () => {
      const cards = getCategoryCards(
        [{ category_id: 'c1', category_name: 'Food', spent: '25.00', monthly_limit: '100.00', category_icon: '🍔' }],
        [{ category_id: 'c1', category_name: 'Food', amount: '99' }],
      )
      expect(cards).toHaveLength(1)
      expect(cards[0].amount).toBe(25)
      expect(cards[0].monthlyLimit).toBe(100)
    })

    it('falls back to derived spend-share cards when no category limits are present', () => {
      const cards = getCategoryCards(
        [{ category_id: 'c1', category_name: 'Food', spent: '25.00', monthly_limit: null }],
        [{ category_id: 'c1', category_name: 'Food', amount: '25' }],
      )
      expect(cards[0].note).toMatch(/% of spend/)
    })
  })

  describe('buildSampleCategoryCards', () => {
    it('maps sample rows through the same presentation and health fields as live cards', () => {
      const [card] = buildSampleCategoryCards([{ id: 'g1', name: 'Trip', budget: 500, spent: 125 }])
      expect(card.monthlyLimit).toBe(500)
      expect(card.amount).toBe(125)
      expect(card.statusLabel).toBeTruthy()
    })
  })

  describe('getTopSavingsGoal', () => {
    it('prioritizes stressed goals over completed ones', () => {
      const top = getTopSavingsGoal({
        goals: [
          { archived: false, target_date: '2026-08-01', budget_context: { status: 'complete' } },
          { archived: false, target_date: '2026-07-01', budget_context: { status: 'over_budget' } },
        ],
      })
      expect(top.target_date).toBe('2026-07-01')
    })

    it('returns null when every goal is archived or the payload is empty', () => {
      expect(getTopSavingsGoal({ goals: [{ archived: true, target_date: '2026-01-01', budget_context: { status: 'tight' } }] })).toBeNull()
      expect(getTopSavingsGoal(null)).toBeNull()
    })
  })

  describe('buildDemoRecentCashFlow', () => {
    it('anchors the trailing month on the live totals and scales the prior two months', () => {
      const series = buildDemoRecentCashFlow({ total_income: '1000', total_expenses: '200' })
      expect(series).toHaveLength(3)
      expect(series[2].incomeAmount).toBe(1000)
      expect(series[2].expenseAmount).toBe(200)
      expect(series[0].month).toBe('2026-01-01')
    })
  })

  describe('getPreviewCategories', () => {
    it('ranks budgeted cards ahead of high-spend unbudgeted rows', () => {
      const preview = getPreviewCategories([
        { name: 'Big', amount: 900, progress: 10, monthlyLimit: null },
        { name: 'Budgeted', amount: 50, progress: 80, monthlyLimit: 500 },
      ], 2)
      expect(preview.map((c) => c.name)).toEqual(['Budgeted', 'Big'])
    })
  })

})
