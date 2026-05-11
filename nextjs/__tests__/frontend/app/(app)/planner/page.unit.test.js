/** @jest-environment jsdom */

jest.mock('@/components/planner-view', () => jest.fn(() => null))

const React = require('react')
const PlannerView = require('@/components/planner-view')
const PlannerPage = require('@/app/(app)/planner/page').default

describe('PlannerPage search params', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes the month query string to PlannerView', () => {
    const element = PlannerPage({ searchParams: { month: '2026-04' } })

    expect(element).toEqual(React.createElement(PlannerView, { initialMonth: '2026-04' }))
  })

  it('uses the first month query value when Next provides an array', () => {
    const element = PlannerPage({ searchParams: { month: ['2026-04', '2026-05'] } })

    expect(element).toEqual(React.createElement(PlannerView, { initialMonth: '2026-04' }))
  })

  it('passes undefined when no month query is present', () => {
    const element = PlannerPage({ searchParams: {} })

    expect(element).toEqual(React.createElement(PlannerView, { initialMonth: undefined }))
  })
})
