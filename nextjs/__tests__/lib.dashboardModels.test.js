const { mergeRowsById, sortRowsByDateDesc } = require('@/lib/dashboardModels')

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
