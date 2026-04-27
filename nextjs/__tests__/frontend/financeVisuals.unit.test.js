const {
  BUILT_IN_EXPENSE_VISUALS,
  BUILT_IN_INCOME_VISUALS,
  getInitialsLabel,
  getCategoryLabel,
  getCategoryVisual,
  getCategoryPresentation,
  isUncategorizedExpenseName,
  isUnknownIncomeName,
  UNCATEGORIZED_EXPENSE_DISPLAY,
  UNCATEGORIZED_EXPENSE_SYMBOL,
  UNKNOWN_INCOME_DISPLAY,
  getBuiltInColorCollisions,
  getEntryVisual,
} = require('@/lib/financeVisuals')

describe('getInitialsLabel', () => {
  it('returns up to two uppercase initials from a name', () => {
    expect(getInitialsLabel('john doe')).toBe('JD')
    expect(getInitialsLabel('alice')).toBe('A')
  })
})

describe('getCategoryLabel', () => {
  it('preserves persisted category names and does not apply keyword renames (e.g. Food → Dining)', () => {
    expect(getCategoryLabel('Food', 'expense')).toBe('Food')
    expect(getCategoryLabel('Dining', 'expense')).toBe('Dining')
  })

  it('uses a clear uncategorized display label for empty expense strings', () => {
    expect(getCategoryLabel('', 'expense')).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(getCategoryLabel('   ', 'expense')).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(getCategoryLabel('', 'expense')).toBe('Uncategorized')
  })

  it('treats null, SQL labels, and old compact fallback values as uncategorized', () => {
    expect(isUncategorizedExpenseName(null)).toBe(true)
    expect(isUncategorizedExpenseName('')).toBe(true)
    expect(isUncategorizedExpenseName('   ')).toBe(true)
    expect(isUncategorizedExpenseName('Uncategorized')).toBe(true)
    expect(isUncategorizedExpenseName('No cat')).toBe(true)
  })

  it('uses no-source display for empty income, not a fake source name', () => {
    expect(getCategoryLabel('', 'income')).toBe(UNKNOWN_INCOME_DISPLAY)
  })

  it('preserves a real persisted income source named "Income"', () => {
    expect(getCategoryLabel('Income', 'income')).toBe('Income')
  })
})

describe('isUnknownIncomeName', () => {
  it('treats blank and explicit no-source display as unknown', () => {
    expect(isUnknownIncomeName(null)).toBe(true)
    expect(isUnknownIncomeName('')).toBe(true)
    expect(isUnknownIncomeName('  ')).toBe(true)
    expect(isUnknownIncomeName(UNKNOWN_INCOME_DISPLAY)).toBe(true)
  })

  it('does not treat the literal name "Income" as unknown', () => {
    expect(isUnknownIncomeName('Income')).toBe(false)
  })
})

describe('getCategoryVisual', () => {
  it('returns an object with the expected shape', () => {
    const visual = getCategoryVisual('grocery store', 'expense')
    expect(visual).toHaveProperty('label')
    expect(visual).toHaveProperty('symbol')
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('soft')
  })

  it('keeps the persisted label on the name while heuristics still affect color for keyword matches', () => {
    const visual = getCategoryVisual('grocery store', 'expense')
    expect(visual.label).toBe('grocery store')
    expect(visual.color).toBe('#4d9a6a')
  })

  it('uses the income-specific fallback color when there is no built-in or keyword match', () => {
    const v = getCategoryVisual('QwertyZzzNoHeuristic99', 'income')
    expect(v.label).toBe('QwertyZzzNoHeuristic99')
    expect(v.color).toBe('#1f7a45')
    expect(v.initials).toBeTruthy()
  })

  it('uses the expense-specific fallback when there is no built-in or keyword match', () => {
    const v = getCategoryVisual('QwertyXxxNoHeuristic99', 'expense')
    expect(v.color).toBe('#7d8c84')
  })
})

describe('getCategoryPresentation', () => {
  it('returns label "Food" for the Food / Dining heuristic collision regression', () => {
    const presentation = getCategoryPresentation({ name: 'Food', kind: 'expense' })
    expect(presentation.label).toBe('Food')
    expect(presentation.color).toBe(BUILT_IN_EXPENSE_VISUALS.Food.color)
    expect(presentation.symbol).toBe(BUILT_IN_EXPENSE_VISUALS.Food.symbol)
  })

  it('matches the uncategorized display label for a missing expense name', () => {
    const presentation = getCategoryPresentation({ name: null, kind: 'expense' })
    expect(presentation.label).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(presentation.symbol).toBe(UNCATEGORIZED_EXPENSE_SYMBOL)
  })

  it('matches the no-source display for a missing or blank income name', () => {
    const p = getCategoryPresentation({ name: '   ', kind: 'income' })
    expect(p.label).toBe(UNKNOWN_INCOME_DISPLAY)
    expect(p.initials).toBe('–')
    const v = getCategoryVisual('No source', 'income')
    expect(v.label).toBe(UNKNOWN_INCOME_DISPLAY)
    expect(v.initials).toBe('–')
  })

  it('uses the server icon when provided (overrides built-in or heuristic symbol, not id)', () => {
    const presentation = getCategoryPresentation({ name: 'Dining', icon: '🧾', kind: 'expense' })
    expect(presentation.symbol).toBe('🧾')
  })

  it('server icon on income still uses built-in or heuristic colors (symbol override only)', () => {
    const p = getCategoryPresentation({ name: 'Salary', icon: '💵', kind: 'income' })
    expect(p.symbol).toBe('💵')
    expect(p.color).toBe(BUILT_IN_INCOME_VISUALS.Salary.color)
  })

  it('aligns display label with getCategoryLabel and does not rename "grocery run"', () => {
    const presentation = getCategoryPresentation({ name: 'grocery run', kind: 'expense' })
    expect(presentation.label).toBe('grocery run')
    expect(presentation.label).toBe(getCategoryLabel('grocery run', 'expense'))
  })

  it('gives built-in seed categories a stable icon+color (Utilities vs merchant initials)', () => {
    const p = getCategoryPresentation({ name: 'Utilities', icon: '💡', kind: 'expense' })
    expect(p.label).toBe('Utilities')
    expect(p.symbol).toBe('💡')
    expect(p.color).toBe(BUILT_IN_EXPENSE_VISUALS.Utilities.color)
  })

  it('uses one Transit bus icon for the Transit category, not a mixed train default', () => {
    const p = getCategoryPresentation({ name: 'Transit', kind: 'expense' })
    expect(p.symbol).toBe(BUILT_IN_EXPENSE_VISUALS.Transit.symbol)
  })
})

describe('built-in color uniqueness (Issue #58)', () => {
  function hexDistance(left, right) {
    const parse = (hex) => {
      const value = hex.replace('#', '')
      return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16))
    }
    const [lr, lg, lb] = parse(left)
    const [rr, rg, rb] = parse(right)
    return Math.sqrt(((lr - rr) ** 2) + ((lg - rg) ** 2) + ((lb - rb) ** 2))
  }

  it('has no duplicate primary colors among shipped expense and income built-ins', () => {
    const { expense, income } = getBuiltInColorCollisions()
    expect(expense).toEqual([])
    expect(income).toEqual([])
  })

  it('keeps a unique hex for every built-in expense and income name', () => {
    const ex = Object.values(BUILT_IN_EXPENSE_VISUALS)
    const inc = Object.values(BUILT_IN_INCOME_VISUALS)
    expect(new Set(ex.map((v) => v.color)).size).toBe(ex.length)
    expect(new Set(inc.map((v) => v.color)).size).toBe(inc.length)
  })

  it('keeps manually flagged color families visibly distinct', () => {
    expect(hexDistance(BUILT_IN_EXPENSE_VISUALS.Education.color, BUILT_IN_EXPENSE_VISUALS.Transit.color)).toBeGreaterThan(90)

    const incomeColors = BUILT_IN_INCOME_VISUALS
    expect(hexDistance(incomeColors.Salary.color, incomeColors.Rental.color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Salary.color, incomeColors['Part-time'].color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Rental.color, incomeColors['Part-time'].color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Freelance.color, incomeColors.Salary.color)).toBeGreaterThan(80)
  })
})

describe('getEntryVisual', () => {
  it('derives a visual from a standard entry', () => {
    const entry = { chip: 'Dining', merchant: 'Starbucks', title: 'Coffee', kind: 'expense' }
    const visual = getEntryVisual(entry)
    expect(visual.label).toBe('Dining')
    expect(visual).toHaveProperty('color')
  })

  it('uses categoryIcon for expenses and sourceIcon for income', () => {
    const expenseV = getEntryVisual({
      chip: 'Food',
      kind: 'expense',
      categoryIcon: '🥘',
    })
    expect(expenseV.label).toBe('Food')
    expect(expenseV.symbol).toBe('🥘')

    const incomeV = getEntryVisual({
      chip: 'Payroll',
      kind: 'income',
      sourceIcon: '💵',
    })
    expect(incomeV.symbol).toBe('💵')
  })

  it('uses categoryName when chip is missing (e.g. detail rows)', () => {
    const v = getEntryVisual({
      kind: 'expense',
      categoryName: 'Health',
      categoryIcon: '💊',
    })
    expect(v.label).toBe('Health')
    expect(v.symbol).toBe('💊')
  })

  it('merges chip, merchant, title, and note when there is no chip or categoryName (heuristics on combined text)', () => {
    const v = getEntryVisual({
      kind: 'expense',
      merchant: 'Refill at CVS pharmacy',
    })
    expect(v.label).toBe('Refill at CVS pharmacy')
    // Keyword "pharmacy" matches the Health heuristic (not a persisted rename)
    expect(v.color).toBe('#2e8a9a')
  })
})
