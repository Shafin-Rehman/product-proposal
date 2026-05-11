jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/budget', () => ({ normalizeMonth: jest.fn() }))
jest.mock('@/lib/monthlyReportExport', () => ({
  buildMonthlyReportExport: jest.fn(),
  getMonthlyReportFilename: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { NextResponse } = require('next/server')
const { authenticate } = require('@/lib/auth')
const { normalizeMonth } = require('@/lib/budget')
const { buildMonthlyReportExport, getMonthlyReportFilename } = require('@/lib/monthlyReportExport')
const exportHandler = require('@/app/api/reports/export/route')

beforeEach(() => {
  authenticate.mockReset()
  normalizeMonth.mockReset()
  buildMonthlyReportExport.mockReset()
  getMonthlyReportFilename.mockReset()

  authenticate.mockResolvedValue({ user: { id: 'uid' } })
  normalizeMonth.mockReturnValue('2026-03-01')
  buildMonthlyReportExport.mockResolvedValue('section,month\r\nsummary,2026-03-01')
  getMonthlyReportFilename.mockReturnValue('budgetbuddy-2026-03-report.csv')
})

describe('GET /api/reports/export', () => {
  it('returns CSV for an authenticated selected-month export', async () => {
    await testApiHandler({
      appHandler: exportHandler,
      url: 'http://localhost/api/reports/export?month=2026-03',
      async test({ fetch }) {
        const response = await fetch()

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/csv; charset=utf-8')
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="budgetbuddy-2026-03-report.csv"')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(await response.text()).toBe('section,month\r\nsummary,2026-03-01')
      },
    })

    expect(normalizeMonth).toHaveBeenCalledWith('2026-03')
    expect(buildMonthlyReportExport).toHaveBeenCalledWith('uid', '2026-03-01')
    expect(getMonthlyReportFilename).toHaveBeenCalledWith('2026-03-01')
  })

  it('returns 400 when the month is invalid', async () => {
    normalizeMonth.mockReturnValueOnce(null)

    await testApiHandler({
      appHandler: exportHandler,
      url: 'http://localhost/api/reports/export?month=bad-date',
      async test({ fetch }) {
        const response = await fetch()

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Valid month is required in YYYY-MM or YYYY-MM-DD format.' })
      },
    })

    expect(buildMonthlyReportExport).not.toHaveBeenCalled()
  })

  it('returns the auth error when unauthenticated', async () => {
    authenticate.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    await testApiHandler({
      appHandler: exportHandler,
      url: 'http://localhost/api/reports/export?month=2026-03-01',
      async test({ fetch }) {
        const response = await fetch()

        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({ error: 'Unauthorized' })
      },
    })

    expect(normalizeMonth).not.toHaveBeenCalled()
  })

  it('returns 500 when export building fails', async () => {
    buildMonthlyReportExport.mockRejectedValueOnce(new Error('db failed'))

    await testApiHandler({
      appHandler: exportHandler,
      url: 'http://localhost/api/reports/export?month=2026-03-01',
      async test({ fetch }) {
        const response = await fetch()

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: 'Failed to export monthly report' })
      },
    })
  })
})
