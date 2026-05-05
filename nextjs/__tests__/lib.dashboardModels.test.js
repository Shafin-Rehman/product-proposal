const { buildDashboardLivePaths, mergeRowsById, sortRowsByDateDesc } = require('@/lib/dashboardModels')

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
