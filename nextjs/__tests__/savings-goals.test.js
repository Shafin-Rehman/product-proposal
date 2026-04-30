jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    buildBudgetSummary: jest.fn(),
  }
})

const { testApiHandler } = require('next-test-api-route-handler')
const { NextResponse } = require('next/server')
const { authenticate } = require('@/lib/auth')
const db = require('@/lib/db')
const budget = require('@/lib/budget')
const savingsGoals = require('@/lib/savingsGoals')
const goalsHandler = require('@/app/api/savings-goals/route')
const updateHandler = require('@/app/api/savings-goals/update/route')
const archiveHandler = require('@/app/api/savings-goals/archive/route')
const { demoSavingsGoals } = require('@/lib/demoData')

const authorizedUser = { id: 'uid', email: 'a@b.com' }
const GOAL_ID = '11111111-1111-4111-8111-111111111111'
const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const rawPost = (body) => ({ method: 'POST', body, headers: { 'content-type': 'application/json' } })

function goalRow(overrides = {}) {
  return {
    id: GOAL_ID,
    name: 'Emergency cushion',
    icon: '🛡️',
    target_amount: '1000.00',
    current_amount: '250.00',
    target_date: '2026-12-31',
    archived: false,
    archived_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  authenticate.mockResolvedValue({ user: authorizedUser })
  budget.buildBudgetSummary.mockResolvedValue({
    month: '2026-04-01',
    total_budget: '1000.00',
    remaining_budget: '500.00',
    total_income: '2000.00',
    total_expenses: '500.00',
  })
})

describe('savings goal helpers', () => {
  it('caps progress at 100 and marks complete before overdue', () => {
    const goal = savingsGoals.buildSavingsGoalProgress(
      goalRow({ target_amount: '100.00', current_amount: '120.00', target_date: '2020-01-01' }),
      { month: '2026-04-01', total_budget: '500.00', remaining_budget: '250.00' },
      new Date('2026-04-15T12:00:00Z')
    )

    expect(goal.progress_percentage).toBe(100)
    expect(goal.remaining_amount).toBe('0.00')
    expect(goal.budget_context.status).toBe('complete')
  })

  it('marks incomplete past-due goals as overdue', () => {
    const goal = savingsGoals.buildSavingsGoalProgress(
      goalRow({ target_amount: '100.00', current_amount: '20.00', target_date: '2026-04-01' }),
      { month: '2026-04-01', total_budget: '500.00', remaining_budget: '250.00' },
      new Date('2026-04-15T12:00:00Z')
    )

    expect(goal.budget_context.status).toBe('overdue')
  })

  it('uses today instead of month start for the current month reference', () => {
    const reference = savingsGoals.getSavingsGoalReferenceDate(
      '2026-04-01',
      new Date('2026-04-29T12:00:00Z')
    )
    const futureReference = savingsGoals.getSavingsGoalReferenceDate(
      '2026-05-01',
      new Date('2026-04-29T12:00:00Z')
    )

    expect(reference.toISOString()).toBe('2026-04-29T12:00:00.000Z')
    expect(futureReference.toISOString()).toBe('2026-05-01T12:00:00.000Z')
  })

  it('computes monthly requirement and budget pressure', () => {
    const ready = savingsGoals.buildSavingsGoalProgress(
      goalRow({ target_amount: '600.00', current_amount: '0.00', target_date: '2026-06-30' }),
      { month: '2026-04-01', total_budget: '1000.00', remaining_budget: '500.00' },
      new Date('2026-04-02T12:00:00Z')
    )
    const tight = savingsGoals.buildSavingsGoalProgress(
      goalRow({ target_amount: '450.00', current_amount: '0.00', target_date: '2026-04-30' }),
      { month: '2026-04-01', total_budget: '1000.00', remaining_budget: '500.00' },
      new Date('2026-04-02T12:00:00Z')
    )

    expect(ready.months_remaining).toBe(3)
    expect(ready.monthly_required).toBe('200.00')
    expect(ready.budget_context.status).toBe('ready')
    expect(tight.budget_context.status).toBe('tight')
  })

  it('summarizes active goals and excludes archived totals', () => {
    const result = savingsGoals.buildSavingsGoalsSummary(
      [
        goalRow({ target_amount: '100.00', current_amount: '20.00', target_date: '2026-05-01' }),
        goalRow({ id: '22222222-2222-4222-8222-222222222222', target_amount: '50.00', current_amount: '50.00', archived: true }),
      ],
      { month: '2026-04-01', total_budget: '1000.00', remaining_budget: '500.00' },
      new Date('2026-04-02T12:00:00Z')
    )

    expect(result.summary.active_count).toBe(1)
    expect(result.summary.archived_count).toBe(1)
    expect(result.summary.target_total).toBe('100.00')
    expect(result.summary.current_total).toBe('20.00')
  })

  it('keeps incomplete demo goals out of complete status', () => {
    demoSavingsGoals.goals.forEach((goal) => {
      if (Number(goal.current_amount) < Number(goal.target_amount)) {
        expect(goal.budget_context.status).not.toBe('complete')
      }
    })
  })
})

describe('GET /api/savings-goals', () => {
  it('returns active goals with summary', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        goalRow(),
        goalRow({ id: '22222222-2222-4222-8222-222222222222', archived: true }),
      ],
    })

    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.goals).toHaveLength(1)
        expect(body.summary.active_count).toBe(1)
        expect(body.summary.archived_count).toBe(1)
      },
    })

    expect(db.query.mock.calls[0][1]).toEqual(['uid', true])
    expect(budget.buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-04-01')
  })

  it('includes archived goals when requested', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ archived: true })] })

    await testApiHandler({
      appHandler: goalsHandler,
      url: 'http://localhost/api/savings-goals?include_archived=true',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
      },
    })

    expect(db.query.mock.calls[0][1]).toEqual(['uid', true])
  })

  it('uses a requested month for budget-context enrichment', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ target_date: '2026-08-31' })] })
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-05-01',
      total_budget: '400.00',
      remaining_budget: '100.00',
      total_income: '2000.00',
      total_expenses: '300.00',
    })

    await testApiHandler({
      appHandler: goalsHandler,
      url: 'http://localhost/api/savings-goals?month=2026-05',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.goals[0].budget_context.month).toBe('2026-05-01')
        expect(body.goals[0].months_remaining).toBe(4)
      },
    })

    expect(budget.buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-05-01')
  })

  it('marks same-month past-due goals overdue when listing current-month context', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-29T12:00:00Z'))
    db.query.mockResolvedValueOnce({
      rows: [
        goalRow({
          target_amount: '1000.00',
          current_amount: '100.00',
          target_date: '2026-04-10',
        }),
      ],
    })

    try {
      await testApiHandler({
        appHandler: goalsHandler,
        url: 'http://localhost/api/savings-goals?month=2026-04',
        async test({ fetch }) {
          const res = await fetch()
          expect(res.status).toBe(200)
          const body = await res.json()
          expect(body.goals[0].budget_context.status).toBe('overdue')
          expect(body.goals[0].months_remaining).toBe(1)
        },
      })
    } finally {
      jest.useRealTimers()
    }

    expect(budget.buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-04-01')
  })

  it('rejects invalid requested months', async () => {
    await testApiHandler({
      appHandler: goalsHandler,
      url: 'http://localhost/api/savings-goals?month=bad',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
      },
    })

    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    authenticate.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(401)
      },
    })
  })
})

describe('POST /api/savings-goals', () => {
  it('creates a valid goal', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ icon: '💻' })] })

    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          name: ' Emergency cushion ',
          icon: '💻',
          target_amount: 1000,
          current_amount: 250,
          target_date: '2026-12-31',
        }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('Emergency cushion')
        expect(body.icon).toBe('💻')
      },
    })

    expect(db.query.mock.calls[0][1][2]).toEqual(expect.any(String))
    expect(db.query.mock.calls[0][1][2]).not.toBe('')
  })

  it('normalizes blank create icons to null', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [goalRow({ icon: null })] })
      .mockResolvedValueOnce({ rows: [goalRow({ icon: null })] })

    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const blankRes = await fetch(post({
          name: 'Emergency cushion',
          icon: '',
          target_amount: 1000,
          current_amount: 250,
          target_date: '2026-12-31',
        }))
        expect(blankRes.status).toBe(200)
        expect((await blankRes.json()).icon).toBeNull()

        const whitespaceRes = await fetch(post({
          name: 'Emergency cushion',
          icon: '   ',
          target_amount: 1000,
          current_amount: 250,
          target_date: '2026-12-31',
        }))
        expect(whitespaceRes.status).toBe(200)
        expect((await whitespaceRes.json()).icon).toBeNull()
      },
    })

    expect(db.query.mock.calls[0][1][2]).toBeNull()
    expect(db.query.mock.calls[1][1][2]).toBeNull()
  })

  it('rejects invalid create payloads', async () => {
    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        expect((await fetch(post({ target_amount: 100, target_date: '2026-12-31' }))).status).toBe(400)
        expect((await fetch(post({ name: 'Goal', target_amount: 0, target_date: '2026-12-31' }))).status).toBe(400)
        expect((await fetch(post({ name: 'Goal', target_amount: 100, current_amount: -1, target_date: '2026-12-31' }))).status).toBe(400)
        expect((await fetch(post({ name: 'Goal', target_amount: 100, target_date: 'bad' }))).status).toBe(400)
      },
    })
  })

  it('rejects malformed and non-object create payloads without a 500', async () => {
    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const cases = [
          rawPost('{'),
          post(null),
          post([]),
          post('not-object'),
        ]

        for (const request of cases) {
          const res = await fetch(request)
          expect(res.status).toBe(400)
          expect((await res.json()).error).toMatch(/JSON|object/)
        }
      },
    })

    expect(db.query).not.toHaveBeenCalled()
  })

  it('uses a requested payload month after creating a goal', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ target_date: '2026-08-31' })] })
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-05-01',
      total_budget: '400.00',
      remaining_budget: '100.00',
      total_income: '2000.00',
      total_expenses: '300.00',
    })

    await testApiHandler({
      appHandler: goalsHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          month: '2026-05',
          name: 'Emergency cushion',
          target_amount: 1000,
          current_amount: 250,
          target_date: '2026-08-31',
        }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.budget_context.month).toBe('2026-05-01')
      },
    })

    expect(budget.buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-05-01')
  })
})

describe('POST /api/savings-goals/update', () => {
  it('updates allowed fields', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ name: 'Updated', icon: '🎓' })] })

    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ goal_id: GOAL_ID, name: 'Updated', icon: '🎓' }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('Updated')
        expect(body.icon).toBe('🎓')
      },
    })
  })

  it('can clear an icon when updating', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ icon: null })] })

    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ goal_id: GOAL_ID, icon: '   ' }))
        expect(res.status).toBe(200)
        expect((await res.json()).icon).toBeNull()
      },
    })

    expect(db.query.mock.calls[0][1][0]).toBeNull()
  })

  it('rejects no fields and returns 404 for missing goals', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        expect((await fetch(post({ goal_id: GOAL_ID }))).status).toBe(400)
      },
    })

    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        expect((await fetch(post({ goal_id: GOAL_ID, name: 'Updated' }))).status).toBe(404)
      },
    })
  })

  it('rejects invalid UUIDs and non-object update payloads', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        expect((await fetch(post({ goal_id: 'bad-id', name: 'Updated' }))).status).toBe(400)
        expect((await fetch(post(null))).status).toBe(400)
        expect((await fetch(post([]))).status).toBe(400)
        expect((await fetch(rawPost('{'))).status).toBe(400)
      },
    })
  })

  it('uses a requested payload month and filters archived goals from updates', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ name: 'Updated', target_date: '2026-08-31' })] })

    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ goal_id: GOAL_ID, month: '2026-05', name: 'Updated' }))
        expect(res.status).toBe(200)
        expect((await res.json()).months_remaining).toBe(4)
      },
    })

    expect(db.query.mock.calls[0][0]).toContain('AND archived = false')
    expect(budget.buildBudgetSummary).toHaveBeenCalledWith('uid', '2026-05-01')
  })
})

describe('POST /api/savings-goals/archive', () => {
  it('archives a goal', async () => {
    db.query.mockResolvedValueOnce({ rows: [goalRow({ archived: true })] })

    await testApiHandler({
      appHandler: archiveHandler,
      async test({ fetch }) {
        const res = await fetch(post({ goal_id: GOAL_ID }))
        expect(res.status).toBe(200)
        expect((await res.json()).archived).toBe(true)
      },
    })
  })

  it('rejects missing, invalid, and non-object archive payloads', async () => {
    await testApiHandler({
      appHandler: archiveHandler,
      async test({ fetch }) {
        expect((await fetch(post({}))).status).toBe(400)
        expect((await fetch(post({ goal_id: 'bad-id' }))).status).toBe(400)
        expect((await fetch(post(null))).status).toBe(400)
        expect((await fetch(post([]))).status).toBe(400)
        expect((await fetch(rawPost('{'))).status).toBe(400)
      },
    })
  })

  it('filters archived goals when archiving', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })

    await testApiHandler({
      appHandler: archiveHandler,
      async test({ fetch }) {
        const res = await fetch(post({ goal_id: GOAL_ID }))
        expect(res.status).toBe(404)
      },
    })

    expect(db.query.mock.calls[0][0]).toContain('AND archived = false')
  })
})
