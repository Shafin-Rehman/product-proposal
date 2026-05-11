const {
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  INCOME_NOTES_MAX_LENGTH,
  validateExpenseDescription,
  validateIncomeNotes,
} = require('@/lib/transactionText')

describe('transactionText specification', () => {
  describe('validateExpenseDescription', () => {
    it('passes through undefined and null', () => {
      expect(validateExpenseDescription(undefined)).toEqual({ value: undefined })
      expect(validateExpenseDescription(null)).toEqual({ value: null })
    })

    it('rejects non-string values', () => {
      expect(validateExpenseDescription(12).error).toContain('text')
    })

    it('trims and collapses whitespace-only to null', () => {
      expect(validateExpenseDescription('   ')).toEqual({ value: null })
    })

    it('rejects strings over the max length', () => {
      const long = 'a'.repeat(EXPENSE_DESCRIPTION_MAX_LENGTH + 1)
      expect(validateExpenseDescription(long).error).toBeTruthy()
    })

    it('returns trimmed text when valid', () => {
      expect(validateExpenseDescription('  Cafe  ')).toEqual({ value: 'Cafe' })
    })
  })

  describe('validateIncomeNotes', () => {
    it('rejects notes that exceed the max length', () => {
      const long = 'n'.repeat(INCOME_NOTES_MAX_LENGTH + 1)
      expect(validateIncomeNotes(long).error).toBeTruthy()
    })

    it('returns trimmed notes when valid', () => {
      expect(validateIncomeNotes('  Weekend shift  ')).toEqual({ value: 'Weekend shift' })
    })
  })
})
