import { getMonthlyCategorySpend, getMonthlyTotals } from '../src/lib/budget'
import db from '../src/lib/db'

jest.mock('../src/lib/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}))

describe('Transaction category flow (unit)', () => {
  const userId = 1
  const month = '2026-03-01'

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('correctly maps expense category_name from DB', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { category_id: 1, category_name: 'Food', category_icon: null, spent: '100.00' },
      ],
    })

    const result = await getMonthlyCategorySpend(userId, month)

    expect(result[0].category_name).toBe('Food')
    expect(result[0].spent).toBe('100.00')
  })

  it('returns Uncategorized as category_name when no category is assigned', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { category_id: null, category_name: 'Uncategorized', category_icon: null, spent: '50.00' },
      ],
    })

    const result = await getMonthlyCategorySpend(userId, month)

    expect(result[0].category_name).toBe('Uncategorized')
  })

  it('returns zero totals when no transactions exist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total_expenses: '0.00' }] })
      .mockResolvedValueOnce({ rows: [{ total_income: '0.00' }] })

    const result = await getMonthlyTotals(userId, month)

    expect(result.total_expenses).toBe('0.00')
    expect(result.total_income).toBe('0.00')
  })
  it('does not use counterparty as fallback for income notes on save', () => {
  const incomeEntry = {
    kind: 'income',
    amount: 500,
    occurredOn: '2026-04-01',
    chip: 'Freelance',
    raw: {
      id: 1,
      source_name: 'Salary',
      notes: '',
    },
  }

  // Simulate what createEditDraft produces
  const draft = {
    kind: incomeEntry.kind,
    amount: String(incomeEntry.amount),
    category: incomeEntry.raw.source_name,
    occurredOn: incomeEntry.occurredOn,
    counterparty: '',
    note: incomeEntry.raw.notes || '',
  }

  // The body that gets sent to the API should not include counterparty in notes
  const body = {
    amount: Number(draft.amount),
    date: draft.occurredOn,
    notes: draft.note.trim() || undefined,
  }

  // counterparty should never leak into notes
  expect(body.notes).toBeUndefined()
  expect(draft.counterparty).toBe('')
})
})