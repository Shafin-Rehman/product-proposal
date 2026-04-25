/** @jest-environment jsdom */

jest.mock('@/lib/financeUtils', () => {
  const actual = jest.requireActual('@/lib/financeUtils')
  return {
    ...actual,
    formatCurrency: jest.fn((value) => {
      const amount = Number(value)
      if (!Number.isFinite(amount)) return '--'
      return `$${amount.toFixed(2)}`
    }),
  }
})

const React = require('react')
const { render, screen, fireEvent, cleanup } = require('@testing-library/react')
const { default: MonthPacingChart } = require('@/components/ui/MonthPacingChart')

afterEach(() => {
  cleanup()
})

describe('MonthPacingChart', () => {
  it('renders the empty-state node when no trend points are provided', () => {
    const emptyState = React.createElement('div', { 'data-testid': 'empty-state' }, 'no data')
    render(React.createElement(MonthPacingChart, {
      trendPoints: [],
      budget: 1000,
      monthLength: 30,
      activeDay: 5,
      emptyState,
    }))
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('renders x-axis labels and the actual/pace/budget legend by default', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [100, 200, 350],
      budget: 1000,
      monthLength: 30,
      activeDay: 3,
    }))
    expect(screen.getByText('Day 1')).toBeTruthy()
    expect(screen.getByText('Day 30')).toBeTruthy()
    expect(screen.getByText('Actual')).toBeTruthy()
    expect(screen.getByText('Pace')).toBeTruthy()
    expect(screen.getByText('Budget')).toBeTruthy()
  })

  it('shifts the focused point with arrow keys and updates the callout', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [50, 100, 150, 200, 300],
      budget: 1200,
      monthLength: 30,
      activeDay: 5,
    }))

    const svg = screen.getByRole('img')
    expect(screen.getAllByText('Day 5').length).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(screen.getAllByText('Day 4').length).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: 'Home' })
    expect(screen.getAllByText('Day 1').length).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: 'End' })
    expect(screen.getAllByText('Day 5').length).toBeGreaterThan(0)
  })

  it('labels the delta as on pace when actual matches the pace value', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [100, 200, 300],
      budget: 1000,
      monthLength: 10,
      activeDay: 3,
    }))

    expect(screen.getAllByText('On pace').length).toBeGreaterThan(0)
  })

  it('labels the delta as over pace when actual exceeds expected pace', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [400, 800, 1200],
      budget: 1000,
      monthLength: 30,
      activeDay: 3,
    }))

    expect(screen.getAllByText(/over pace/).length).toBeGreaterThan(0)
  })

  it('labels the delta as under pace when actual is below expected pace', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [10, 20, 30],
      budget: 1200,
      monthLength: 30,
      activeDay: 3,
    }))

    expect(screen.getAllByText(/under pace/).length).toBeGreaterThan(0)
  })

  it('omits Pace and Budget when no budget is set', () => {
    render(React.createElement(MonthPacingChart, {
      trendPoints: [50, 100, 150],
      budget: 0,
      monthLength: 30,
      activeDay: 3,
    }))

    expect(screen.queryByText('Pace')).toBeNull()
    expect(screen.queryByText('Budget')).toBeNull()
    expect(screen.queryByText('Status')).toBeNull()
  })
})
