const { mergeRowsById } = require('@/lib/dashboardModels')

describe('mergeRowsById', () => {
  it('prefers later rows when duplicate ids are merged', () => {
    const older = { id: 'tx-1', amount: '10.00', label: 'older' }
    const newer = { id: 'tx-1', amount: '12.50', label: 'newer' }
    const unique = { id: 'tx-2', amount: '8.00', label: 'unique' }

    expect(mergeRowsById([older], [unique, newer])).toEqual([newer, unique])
  })
})
