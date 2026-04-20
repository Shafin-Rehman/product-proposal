import * as budget from '../src/lib/budget'
import db from '../src/lib/db'

jest.mock('../src/lib/db')

describe('Transaction category flow (integration)', () => {
  const userId = 1
  const month = '2026-03-01'

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('correctly maps expense and income categories from DB', async () => {
    db.query.mockImplementation((query) => {
      if (query.includes('expenses')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              amount: 100,
              category_name: 'Food',
            },
          ],
        })
      }

      if (query.includes('income')) {
        return Promise.resolve({
          rows: [
            {
              id: 2,
              amount: 1000,
              category_name: 'Salary',
            },
          ],
        })
      }

      return Promise.resolve({ rows: [] })
    })

    const result = await budget.getTransactions(userId, month)

    expect(result.expenses[0].category).toBe('Food')
    expect(result.income[0].category).toBe('Salary')
  })
})