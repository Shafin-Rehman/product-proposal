jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}))

const db = require('@/lib/db').default
const {
  archiveSavingsGoal,
  buildSavingsGoalProgress,
  buildSavingsGoalsSummary,
  createSavingsGoal,
  getSavingsGoalById,
  getSavingsGoalReferenceDate,
  isNonNegativeMoneyValue,
  isValidGoalId,
  listSavingsGoals,
  normalizeGoalIcon,
  normalizeGoalName,
  normalizeGoalTargetDate,
  SavingsGoalValidationError,
  updateSavingsGoal,
} = require('@/lib/savingsGoals')

describe('savingsGoals specification', () => {
  describe('normalizeGoalName', () => {
    it('trims and rejects empty or oversized names', () => {
      expect(normalizeGoalName('  Trip  ')).toBe('Trip')
      expect(normalizeGoalName('')).toBeNull()
      expect(normalizeGoalName('a'.repeat(81))).toBeNull()
      expect(normalizeGoalName(12)).toBeNull()
    })
  })

  describe('normalizeGoalIcon', () => {
    it('accepts short strings and rejects invalid input', () => {
      expect(normalizeGoalIcon(' ✈️ ')).toBe('✈️')
      expect(normalizeGoalIcon('')).toBeNull()
      expect(normalizeGoalIcon('a'.repeat(9))).toBeNull()
    })
  })

  describe('normalizeGoalTargetDate', () => {
    it('accepts or rejects goal target dates using the same calendar rules as budget dates', () => {
      expect(normalizeGoalTargetDate('2026-05-10')).toBe('2026-05-10')
      expect(normalizeGoalTargetDate('invalid')).toBeNull()
    })
  })

  describe('isNonNegativeMoneyValue', () => {
    it('accepts zero and typical decimal strings', () => {
      expect(isNonNegativeMoneyValue(0)).toBe(true)
      expect(isNonNegativeMoneyValue('0.00')).toBe(true)
      expect(isNonNegativeMoneyValue('99999999.99')).toBe(true)
    })

    it('rejects negatives, oversize values, and malformed strings', () => {
      expect(isNonNegativeMoneyValue(-1)).toBe(false)
      expect(isNonNegativeMoneyValue('100000000.00')).toBe(false)
      expect(isNonNegativeMoneyValue('1.005')).toBe(false)
      expect(isNonNegativeMoneyValue('x')).toBe(false)
    })
  })

  describe('isValidGoalId', () => {
    it('accepts RFC4122 UUID strings', () => {
      expect(isValidGoalId('11111111-1111-4111-8111-111111111111')).toBe(true)
      expect(isValidGoalId('not-a-uuid')).toBe(false)
    })
  })

  describe('getSavingsGoalReferenceDate', () => {
    it('uses the live clock for the active calendar month', () => {
      const ref = new Date('2026-03-15T12:00:00Z')
      const picked = getSavingsGoalReferenceDate('2026-03-01', ref)
      expect(picked.getTime()).toBe(ref.getTime())
    })

    it('snaps to the month start for non-current months', () => {
      const ref = new Date('2026-03-15T12:00:00Z')
      const picked = getSavingsGoalReferenceDate('2026-04-01', ref)
      expect(picked.toISOString()).toBe('2026-04-01T12:00:00.000Z')
    })
  })

  describe('buildSavingsGoalProgress', () => {
    it('computes remaining balance and budget context', () => {
      const goal = {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Trip',
        icon: null,
        target_amount: '400.00',
        current_amount: '100.00',
        target_date: '2026-06-30',
        archived: false,
      }
      const budgetSummary = {
        month: '2026-03-01',
        total_budget: '1000.00',
        remaining_budget: '500.00',
        total_income: '2000.00',
        total_expenses: '200.00',
      }
      const progress = buildSavingsGoalProgress(goal, budgetSummary, new Date('2026-03-10T12:00:00Z'))
      expect(progress.remaining_amount).toBe('300.00')
      expect(progress.budget_context.status).toBe('ready')
      expect(progress.monthly_required).toBeTruthy()
    })
  })

  describe('buildSavingsGoalsSummary', () => {
    it('aggregates totals and splits archived goals', () => {
      const goals = [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'A',
          target_amount: '200.00',
          current_amount: '50.00',
          target_date: '2026-12-01',
          archived: false,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'B',
          target_amount: '100.00',
          current_amount: '100.00',
          target_date: '2026-05-01',
          archived: true,
        },
      ]
      const summary = buildSavingsGoalsSummary(goals, {
        month: '2026-03-01',
        total_budget: '800.00',
        remaining_budget: '400.00',
      }, new Date('2026-03-05T12:00:00Z'))

      expect(summary.goals).toHaveLength(2)
      expect(summary.summary.active_count).toBe(1)
      expect(summary.summary.archived_count).toBe(1)
      expect(Number(summary.summary.target_total)).toBeGreaterThan(0)
    })
  })

  describe('SavingsGoalValidationError', () => {
    it('is a named error for validation failures', () => {
      const err = new SavingsGoalValidationError('bad')
      expect(err.name).toBe('SavingsGoalValidationError')
      expect(err.message).toBe('bad')
    })
  })

  const goalRow = {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Trip',
    icon: null,
    target_amount: '200.00',
    current_amount: '25.00',
    target_date: '2026-11-15',
    archived: false,
    archived_at: null,
    created_at: null,
    updated_at: null,
  }

  describe('listSavingsGoals', () => {
    beforeEach(() => {
      db.query.mockReset()
    })

    it('maps database rows into API-shaped goals', async () => {
      db.query.mockResolvedValueOnce({ rows: [goalRow] })
      const goals = await listSavingsGoals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')

      expect(goals).toHaveLength(1)
      expect(goals[0]).toEqual(expect.objectContaining({ name: 'Trip', target_amount: '200.00' }))
      expect(db.query.mock.calls[0][1]).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false])
    })
  })

  describe('getSavingsGoalById', () => {
    beforeEach(() => {
      db.query.mockReset()
    })

    it('returns null when the goal is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const goal = await getSavingsGoalById('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', goalRow.id)

      expect(goal).toBeNull()
    })

    it('returns the serialized row when present', async () => {
      db.query.mockResolvedValueOnce({ rows: [goalRow] })
      const goal = await getSavingsGoalById('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', goalRow.id)

      expect(goal?.id).toBe(goalRow.id)
    })
  })

  describe('createSavingsGoal', () => {
    beforeEach(() => {
      db.query.mockReset()
    })

    it('rejects invalid create payloads without persisting anything', async () => {
      await expect(createSavingsGoal('user-1', { name: '   ' })).rejects.toBeInstanceOf(SavingsGoalValidationError)

      expect(db.query).not.toHaveBeenCalled()
    })

    it('persists a new goal with trimmed fields and returns what the API should expose', async () => {
      db.query.mockResolvedValueOnce({ rows: [goalRow] })
      const created = await createSavingsGoal('user-1', {
        name: ' Trip ',
        target_amount: '200.00',
        target_date: '2026-11-15',
      })
      expect(created).toEqual(expect.objectContaining({
        name: 'Trip',
        target_amount: '200.00',
        target_date: '2026-11-15',
        id: goalRow.id,
      }))
      expect(db.query).toHaveBeenCalledTimes(1)
      const [, args] = db.query.mock.calls[0]
      expect(args[0]).toBe('user-1')
      expect(args[1]).toBe('Trip')
      expect(args).toEqual(expect.arrayContaining(['user-1', 'Trip', '200.00', '2026-11-15']))
    })
  })

  describe('updateSavingsGoal', () => {
    beforeEach(() => {
      db.query.mockReset()
    })

    it('rejects malformed goal ids', async () => {
      await expect(updateSavingsGoal('user-1', 'bad-id', { name: 'x' })).rejects.toBeInstanceOf(SavingsGoalValidationError)

      expect(db.query).not.toHaveBeenCalled()
    })

    it('returns null when no row matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const updated = await updateSavingsGoal('user-1', goalRow.id, { name: 'Renamed' })

      expect(updated).toBeNull()
    })

    it('throws when no updatable fields are supplied', async () => {
      await expect(updateSavingsGoal('user-1', goalRow.id, {})).rejects.toBeInstanceOf(SavingsGoalValidationError)
    })
  })

  describe('archiveSavingsGoal', () => {
    beforeEach(() => {
      db.query.mockReset()
    })

    it('returns null when nothing was archived', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const archived = await archiveSavingsGoal('user-1', goalRow.id)

      expect(archived).toBeNull()
    })

    it('returns the archived row on success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...goalRow, archived: true }] })
      const archived = await archiveSavingsGoal('user-1', goalRow.id)

      expect(archived?.archived).toBe(true)
    })
  })

})
