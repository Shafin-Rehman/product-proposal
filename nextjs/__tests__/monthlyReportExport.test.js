jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => ({
  buildBudgetSummary: jest.fn(),
}))

const db = require('@/lib/db')
const { buildBudgetSummary } = require('@/lib/budget')
const {
  buildMonthlyReportCsv,
  buildMonthlyReportExport,
  escapeCsvCell,
  getMonthlyReportFilename,
  getMonthlyReportTransactions,
} = require('@/lib/monthlyReportExport')

beforeEach(() => {
  db.query.mockReset()
  buildBudgetSummary.mockReset()
})

describe('monthly report CSV helpers', () => {
  it('escapes CSV cells and neutralizes spreadsheet formulas in text values', () => {
    expect(escapeCsvCell('Cafe, "Study"\nNight')).toBe('"Cafe, ""Study""\nNight"')
    expect(escapeCsvCell('  padded  ')).toBe('"  padded  "')
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(escapeCsvCell(' +cmd')).toBe("' +cmd")
    expect(escapeCsvCell('-12')).toBe("'-12")
    expect(escapeCsvCell('@handle')).toBe("'@handle")
    expect(escapeCsvCell('-12', { text: false })).toBe('-12')
  })

  it('builds a selected-month CSV with summary and sorted transaction rows', () => {
    const csv = buildMonthlyReportCsv({
      month: '2026-03-01',
      summary: {
        total_income: '3200.00',
        total_expenses: '15.50',
        total_budget: '1000.00',
        remaining_budget: '984.50',
      },
      transactions: [
        {
          id: 'inc-1',
          month: '2026-03-01',
          type: 'income',
          date: '2026-03-02',
          title: '=Payroll',
          category_or_source: 'Salary',
          description_or_notes: 'Campus job',
          amount: '3200',
          created_at: '2026-03-02T12:00:00Z',
        },
        {
          id: 'exp-1',
          month: '2026-03-01',
          type: 'expense',
          date: '2026-03-03',
          title: 'Coffee, bagel',
          category_or_source: 'Dining',
          description_or_notes: 'Line 1\nLine 2',
          amount: '15.5',
          created_at: '2026-03-03T08:00:00Z',
        },
      ],
    })

    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('section,month,type,date,title,category_or_source,description_or_notes,amount,total_income,total_expenses,net_cash_flow,total_budget,remaining_budget,id,created_at')
    expect(lines[1]).toBe('summary,2026-03-01,monthly_summary,,,,,,3200.00,15.50,3184.50,1000.00,984.50,,')
    expect(lines[2]).toContain('transaction,2026-03-01,expense,2026-03-03,"Coffee, bagel",Dining,"Line 1\nLine 2",15.50')
    expect(lines[3]).toContain("transaction,2026-03-01,income,2026-03-02,'=Payroll,Salary,Campus job,3200.00")
  })

  it('uses safe report filenames', () => {
    expect(getMonthlyReportFilename('2026-03-01')).toBe('budgetbuddy-2026-03-report.csv')
    expect(getMonthlyReportFilename('bad/month')).toBe('budgetbuddy-monthly-report.csv')
  })
})

describe('monthly report data access', () => {
  it('queries selected-month expenses and income, then sorts the combined rows', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'exp-1',
            type: 'expense',
            date: '2026-03-05',
            created_at: '2026-03-05T10:00:00Z',
            amount: '12.00',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inc-1',
            type: 'income',
            date: '2026-03-06',
            created_at: '2026-03-06T10:00:00Z',
            amount: '200.00',
          },
        ],
      })

    const rows = await getMonthlyReportTransactions('uid', '2026-03-01')

    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM public.expenses'), ['uid', '2026-03-01', '2026-04-01'])
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM public.income'), ['uid', '2026-03-01', '2026-04-01'])
    expect(rows.map((row) => row.id)).toEqual(['inc-1', 'exp-1'])
  })

  it('builds the full CSV from budget summary and selected-month transactions', async () => {
    buildBudgetSummary.mockResolvedValueOnce({
      total_income: '0.00',
      total_expenses: '0.00',
      total_budget: null,
      remaining_budget: null,
    })
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const csv = await buildMonthlyReportExport('uid', '2026-03-01')

    expect(buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-03-01')
    expect(csv).toContain('summary,2026-03-01,monthly_summary')
    expect(csv).toContain('0.00,0.00,0.00')
  })
})
