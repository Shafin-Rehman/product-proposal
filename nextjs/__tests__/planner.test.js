const {
  areMoneyDraftValuesEquivalent,
  buildPlannerDraftSnapshot,
  buildCopyLastMonthPayload,
  buildPlannerRows,
  buildPlannerSummary,
  formatMoneyDraftValue,
  getCopyLastMonthState,
  getPlannerAdjacentMonths,
  mergePlannerDrafts,
  normalizeMoneyDraftForSave,
} = require('@/lib/planner')

describe('buildPlannerRows', () => {
  it('builds an empty editable row when a category has no spend and no plan', () => {
    const rows = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [],
      categoryStatuses: [],
    })

    expect(rows).toEqual([
      expect.objectContaining({
        categoryId: 'cat-food',
        categoryName: 'Food',
        plannedAmount: null,
        spentAmount: 0,
        remainingAmount: null,
        progressPercentage: 0,
        statusLabel: 'No plan',
        isEditable: true,
      }),
    ])
  })

  it('builds an active planned row that is still on track', () => {
    const [row] = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [{ category_id: 'cat-food', monthly_limit: '120.00' }],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food', spent: '54.00', monthly_limit: '120.00' }],
    })

    expect(row).toEqual(expect.objectContaining({
      plannedAmount: 120,
      spentAmount: 54,
      remainingAmount: 66,
      progressPercentage: 45,
      statusLabel: 'On track',
    }))
  })

  it('flags rows at or above 80 percent as near limit', () => {
    const [row] = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [{ category_id: 'cat-food', monthly_limit: '100.00' }],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food', spent: '80.00', monthly_limit: '100.00' }],
    })

    expect(row).toEqual(expect.objectContaining({
      remainingAmount: 20,
      progressPercentage: 80,
      statusLabel: 'Near limit',
      statusTone: 'warning',
    }))
  })

  it('flags rows over the limit as over budget', () => {
    const [row] = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [{ category_id: 'cat-food', monthly_limit: '100.00' }],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food', spent: '125.00', monthly_limit: '100.00' }],
    })

    expect(row).toEqual(expect.objectContaining({
      remainingAmount: -25,
      progressPercentage: 100,
      statusLabel: 'Over budget',
      statusTone: 'danger',
    }))
  })

  it('appends spend-only or uncategorized rows as read-only planner rows', () => {
    const rows = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [],
      categoryStatuses: [
        { category_id: null, category_name: 'Uncategorized', spent: '18.00', monthly_limit: null },
      ],
    })

    expect(rows).toContainEqual(expect.objectContaining({
      categoryId: null,
      categoryName: 'Uncategorized',
      spentAmount: 18,
      statusLabel: 'Unplanned spend',
      isEditable: false,
    }))
  })

  it('shows full progress for unplanned spend rows once money has been spent', () => {
    const [row] = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food', spent: '18.25', monthly_limit: null }],
    })

    expect(row).toEqual(expect.objectContaining({
      plannedAmount: null,
      spentAmount: 18.25,
      progressPercentage: 100,
      statusLabel: 'Unplanned spend',
      statusTone: 'warning',
    }))
  })

  it('keeps summary-only rows editable when they still have a valid category id', () => {
    const [row] = buildPlannerRows({
      categories: [],
      categoryBudgets: [],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food', spent: '25.00', monthly_limit: '60.00' }],
    })

    expect(row).toEqual(expect.objectContaining({
      categoryId: 'cat-food',
      categoryName: 'Food',
      plannedAmount: 60,
      spentAmount: 25,
      isEditable: true,
    }))
  })

  it('renders saved category budgets even when categories and summary are unavailable', () => {
    const [row] = buildPlannerRows({
      categories: [],
      categoryBudgets: [{ category_id: 'cat-food', category_name: 'Food', category_icon: '🍔', monthly_limit: '60.00' }],
      categoryStatuses: [],
      actualsAvailable: false,
    })

    expect(row).toEqual(expect.objectContaining({
      categoryId: 'cat-food',
      categoryName: 'Food',
      categoryIcon: '🍔',
      plannedAmount: 60,
      spentAmount: null,
      statusLabel: 'Actual unavailable',
      isEditable: true,
      hasSavedPlan: true,
    }))
  })

  it('dedupes budget fallback rows when a summary-backed row for the same category already exists', () => {
    const rows = buildPlannerRows({
      categories: [],
      categoryBudgets: [{ category_id: 'cat-food', category_name: 'Food budget', category_icon: '🍔', monthly_limit: '60.00' }],
      categoryStatuses: [{ category_id: 'cat-food', category_name: 'Food status', category_icon: '🥗', spent: '25.00', monthly_limit: null }],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(expect.objectContaining({
      categoryId: 'cat-food',
      categoryName: 'Food status',
      categoryIcon: '🥗',
      plannedAmount: 60,
      spentAmount: 25,
      isEditable: true,
    }))
  })

  it('does not fabricate actual spend when actual summary data is unavailable', () => {
    const [row] = buildPlannerRows({
      categories: [{ id: 'cat-food', name: 'Food', icon: null }],
      categoryBudgets: [{ category_id: 'cat-food', monthly_limit: '100.00' }],
      categoryStatuses: [],
      actualsAvailable: false,
    })

    expect(row).toEqual(expect.objectContaining({
      plannedAmount: 100,
      spentAmount: null,
      remainingAmount: null,
      progressPercentage: 0,
      statusLabel: 'Actual unavailable',
      statusTone: 'neutral',
    }))
  })
})

describe('buildPlannerSummary', () => {
  it('does not fabricate actual totals when summary data is missing', () => {
    expect(buildPlannerSummary({
      rows: [
        { id: 'cat-food', plannedAmount: 100, spentAmount: null },
      ],
      summary: null,
      config: { monthly_limit: '300.00' },
    })).toEqual({
      plannedTotal: 100,
      spentTotal: null,
      remainingTotal: null,
      overallLimit: 300,
      overallRemaining: null,
      hasActualSpendData: false,
    })
  })
})

describe('planner draft merging', () => {
  it('serializes planner snapshots with a canonical two-decimal money format', () => {
    expect(buildPlannerDraftSnapshot([
      { id: 'cat-food', plannedAmount: 1.1 },
      { id: 'cat-fun', plannedAmount: 80 },
    ], 500)).toEqual({
      rowDrafts: {
        'cat-food': '1.10',
        'cat-fun': '80.00',
      },
      overallDraft: '500.00',
    })
  })

  it('treats equivalent money drafts as equal even when formatting differs', () => {
    expect(areMoneyDraftValuesEquivalent('1.1', '1.10')).toBe(true)
    expect(areMoneyDraftValuesEquivalent('01.10', '1.10')).toBe(true)
    expect(areMoneyDraftValuesEquivalent('1.', '1.00')).toBe(true)
    expect(areMoneyDraftValuesEquivalent('1e2', '100.00')).toBe(true)
    expect(areMoneyDraftValuesEquivalent('.', '1.00')).toBe(false)
  })

  it('preserves dirty row drafts during background refreshes', () => {
    const snapshot = buildPlannerDraftSnapshot([
      { id: 'cat-food', plannedAmount: 100 },
      { id: 'cat-fun', plannedAmount: 80 },
    ], 500)

    expect(mergePlannerDrafts({
      currentRowDrafts: { 'cat-food': '145', 'cat-fun': '80' },
      currentOverallDraft: '500.00',
      nextRowDrafts: snapshot.rowDrafts,
      nextOverallDraft: snapshot.overallDraft,
      dirtyRowIds: new Set(['cat-food']),
      isOverallDirty: false,
    })).toEqual({
      rowDrafts: { 'cat-food': '145', 'cat-fun': '80.00' },
      overallDraft: '500.00',
      dirtyRowIds: new Set(['cat-food']),
      isOverallDirty: false,
    })
  })

  it('hydrates clean rows from the latest server values and clears resolved dirty flags', () => {
    expect(mergePlannerDrafts({
      currentRowDrafts: { 'cat-food': '145.0' },
      currentOverallDraft: '500.0',
      nextRowDrafts: { 'cat-food': '145.00' },
      nextOverallDraft: '500.00',
      dirtyRowIds: new Set(['cat-food']),
      isOverallDirty: true,
    })).toEqual({
      rowDrafts: { 'cat-food': '145.0' },
      overallDraft: '500.0',
      dirtyRowIds: new Set(),
      isOverallDirty: false,
    })
  })

  it('clears dirty flags for equivalent values without rewriting in-progress drafts', () => {
    expect(mergePlannerDrafts({
      currentRowDrafts: { 'cat-food': '1.' },
      currentOverallDraft: '5e2',
      nextRowDrafts: { 'cat-food': '1.00' },
      nextOverallDraft: '500.00',
      dirtyRowIds: new Set(['cat-food']),
      isOverallDirty: true,
    })).toEqual({
      rowDrafts: { 'cat-food': '1.' },
      overallDraft: '5e2',
      dirtyRowIds: new Set(),
      isOverallDirty: false,
    })
  })

  it('prunes dirty ids for rows that no longer exist in the next snapshot', () => {
    expect(mergePlannerDrafts({
      currentRowDrafts: { 'cat-food': '25.00', 'cat-fun': '10.00' },
      currentOverallDraft: '500.00',
      nextRowDrafts: { 'cat-food': '25.00' },
      nextOverallDraft: '500.00',
      dirtyRowIds: new Set(['cat-fun']),
      isOverallDirty: false,
    })).toEqual({
      rowDrafts: { 'cat-food': '25.00' },
      overallDraft: '500.00',
      dirtyRowIds: new Set(),
      isOverallDirty: false,
    })
  })
})

describe('planner money normalization', () => {
  it('formats valid money drafts with two decimals', () => {
    expect(formatMoneyDraftValue(1.1)).toBe('1.10')
    expect(formatMoneyDraftValue('80')).toBe('80.00')
    expect(formatMoneyDraftValue('')).toBe('')
  })

  it('normalizes valid save drafts to the stored two-decimal number shape', () => {
    expect(normalizeMoneyDraftForSave('1.005')).toBe(1.01)
    expect(normalizeMoneyDraftForSave('1.105')).toBe(1.11)
    expect(normalizeMoneyDraftForSave('80')).toBe(80)
    expect(normalizeMoneyDraftForSave('1.')).toBe(1)
    expect(normalizeMoneyDraftForSave('99999999.99')).toBe(99999999.99)
    expect(normalizeMoneyDraftForSave('100000000.00')).toBeNull()
    expect(normalizeMoneyDraftForSave('0.004')).toBeNull()
    expect(normalizeMoneyDraftForSave('1e1000')).toBeNull()
    expect(normalizeMoneyDraftForSave('')).toBeNull()
  })
})

describe('getPlannerAdjacentMonths', () => {
  it('returns the earlier and later month around the selected month', () => {
    expect(getPlannerAdjacentMonths('2026-03-01')).toEqual({
      previousMonth: '2026-02-01',
      nextMonth: '2026-04-01',
    })
  })
})

describe('getCopyLastMonthState', () => {
  it('enables copy when the target month is empty and the previous month has a saved plan', () => {
    expect(getCopyLastMonthState({
      currentConfig: null,
      previousConfig: {
        month: '2026-02-01',
        monthly_limit: '800.00',
        category_budgets: [],
      },
    })).toEqual({
      disabled: false,
      reason: 'Copy last month\'s overall cap into this month.',
    })
  })

  it('disables copy when the previous month has no saved plan', () => {
    expect(getCopyLastMonthState({
      currentConfig: null,
      previousConfig: null,
    })).toEqual({
      disabled: true,
      reason: 'No saved plan was found for last month.',
    })
  })

  it('disables copy when the previous month is unavailable', () => {
    expect(getCopyLastMonthState({
      currentConfig: null,
      previousConfig: null,
      isPreviousMonthUnavailable: true,
    })).toEqual({
      disabled: true,
      reason: 'Last month is unavailable right now.',
    })
  })

  it('disables copy when the target month already has a saved plan', () => {
    expect(getCopyLastMonthState({
      currentConfig: {
        month: '2026-03-01',
        monthly_limit: '350.00',
        category_budgets: [{ category_id: 'cat-food', monthly_limit: '100.00' }],
      },
      previousConfig: {
        month: '2026-02-01',
        monthly_limit: '800.00',
        category_budgets: [{ category_id: 'cat-fun', monthly_limit: '80.00' }],
      },
    })).toEqual({
      disabled: true,
      reason: 'This month already has all the planner data that can be copied safely.',
    })
  })

  it('allows copying only missing planner pieces from the previous month', () => {
    expect(getCopyLastMonthState({
      currentConfig: {
        month: '2026-03-01',
        monthly_limit: '350.00',
        category_budgets: [],
      },
      previousConfig: {
        month: '2026-02-01',
        monthly_limit: '800.00',
        category_budgets: [{ category_id: 'cat-fun', monthly_limit: '80.00' }],
      },
    })).toEqual({
      disabled: false,
      reason: 'Copy last month\'s category budgets into this month.',
    })
  })
})

describe('buildCopyLastMonthPayload', () => {
  it('creates a copy payload from the previous month config', () => {
    expect(buildCopyLastMonthPayload('2026-03-01', {
      month: '2026-02-01',
      monthly_limit: '700.00',
      category_budgets: [
        { category_id: 'cat-food', monthly_limit: '150.00' },
      ],
    })).toEqual({
      month: '2026-03-01',
      monthly_limit: 700,
      category_budgets: [
        { category_id: 'cat-food', monthly_limit: 150 },
      ],
    })
  })

  it('copies only missing planner dimensions from the previous month', () => {
    expect(buildCopyLastMonthPayload('2026-03-01', {
      month: '2026-02-01',
      monthly_limit: '700.00',
      category_budgets: [
        { category_id: 'cat-food', monthly_limit: '150.00' },
      ],
    }, {
      month: '2026-03-01',
      monthly_limit: '500.00',
      category_budgets: [],
    })).toEqual({
      month: '2026-03-01',
      category_budgets: [
        { category_id: 'cat-food', monthly_limit: 150 },
      ],
    })
  })
})
