const {
  getSavingsGoalAvatar,
  getSavingsGoalStatusLabel,
  getSavingsGoalStatusReason,
  getSavingsGoalStatusTone,
} = require('@/lib/savingsGoalStatus')

describe('savingsGoalStatus specification', () => {
  describe('getSavingsGoalStatusLabel', () => {
    it.each([
      ['complete', 'Complete'],
      ['overdue', 'Overdue'],
      ['over_budget', 'Over budget'],
      ['tight', 'Watch'],
      ['no_budget', 'No budget'],
      ['ready', 'On track'],
      ['unknown', 'On track'],
    ])('maps %s to %s', (status, label) => {
      expect(getSavingsGoalStatusLabel(status)).toBe(label)
    })
  })

  describe('getSavingsGoalStatusTone', () => {
    it.each([
      ['complete', 'positive'],
      ['ready', 'positive'],
      ['tight', 'warning'],
      ['no_budget', 'warning'],
      ['over_budget', 'danger'],
      ['overdue', 'danger'],
      ['on_track', 'neutral'],
    ])('maps %s to %s', (status, tone) => {
      expect(getSavingsGoalStatusTone(status)).toBe(tone)
    })
  })

  describe('getSavingsGoalAvatar', () => {
    it('returns the stored icon when present', () => {
      expect(getSavingsGoalAvatar({ icon: '🎯', name: 'X' })).toBe('🎯')
    })

    it('uses semantic initials when enabled', () => {
      expect(getSavingsGoalAvatar({ name: 'Emergency fund' }, { semanticFallbacks: true })).toBe('EF')
      expect(getSavingsGoalAvatar({ name: 'Spring trip' }, { semanticFallbacks: true })).toBe('TR')
    })

    it('falls back to two-word initials then a short prefix', () => {
      expect(getSavingsGoalAvatar({ name: 'College Savings' })).toBe('CS')
      expect(getSavingsGoalAvatar({ name: 'Rain' })).toBe('RA')
      expect(getSavingsGoalAvatar({ name: '' })).toBe('SG')
    })
  })

  describe('getSavingsGoalStatusReason', () => {
    const base = { monthly_required: '100.00', remaining_amount: '50.00' }

    it('describes complete and overdue outcomes', () => {
      expect(getSavingsGoalStatusReason({ ...base, budget_context: { status: 'complete' } })).toContain('Saved amount reached')
      expect(getSavingsGoalStatusReason({ ...base, budget_context: { status: 'overdue' } })).toContain('Target date passed')
    })

    it('explains over budget with and without remaining budget context', () => {
      expect(getSavingsGoalStatusReason({
        ...base,
        budget_context: { status: 'over_budget', remaining_budget: '20.00' },
      })).toContain('Needs')
      expect(getSavingsGoalStatusReason({
        ...base,
        budget_context: { status: 'over_budget', remaining_budget: null },
      })).toContain('without a clear remaining budget')
    })

    it('covers tight, no budget, and healthy pacing', () => {
      expect(getSavingsGoalStatusReason({ ...base, budget_context: { status: 'tight' } })).toContain('little room')
      expect(getSavingsGoalStatusReason({ ...base, budget_context: { status: 'no_budget' } })).toContain('No monthly budget')
      expect(getSavingsGoalStatusReason({ ...base, monthly_required: '0', budget_context: { status: 'ready' } })).toContain(
        'No monthly contribution',
      )
    })
  })
})
