/** @jest-environment jsdom */

jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return '--'
    return `$${amount.toFixed(2)}`
  }),
}))

const React = require('react')
const { render, screen, fireEvent, cleanup } = require('@testing-library/react')
const { default: PaceVsLastMonthChart } = require('@/components/ui/PaceVsLastMonthChart')

afterEach(() => {
  cleanup()
})

function buildCumulative(amounts) {
  let running = 0
  return amounts.map((amount, index) => {
    running += Number(amount)
    return { day: index + 1, amount: running }
  })
}

describe('PaceVsLastMonthChart', () => {
  it('renders the empty state when neither month has activity', () => {
    render(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: [],
      previousMonthSeries: [],
    }))

    expect(screen.getByText(/Month-over-month pace appears/i)).toBeTruthy()
  })

  it('renders both lines, the today divider, and the focused-day callout', () => {
    const currentSeries = buildCumulative([40, 60, 30, 0, 50])
    const previousSeries = buildCumulative([30, 20, 20, 40, 30, 20, 30])

    const { container } = render(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: currentSeries,
      previousMonthSeries: previousSeries,
      currentMonthLabel: 'March',
      previousMonthLabel: 'February',
      monthLength: 31,
    }))

    expect(container.querySelector('.pace-chart__line--current')).toBeTruthy()
    expect(container.querySelector('.pace-chart__line--previous')).toBeTruthy()
    expect(container.querySelector('.pace-chart__today-divider')).toBeTruthy()
    expect(screen.getAllByText('March').length).toBeGreaterThan(0)
    fireEvent.mouseEnter(container.querySelector('.pace-chart__plot'))
    expect(screen.getAllByText(/Day 5/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/March \$180\.00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/February \$140\.00/).length).toBeGreaterThan(0)
  })

  it('shifts the inspected day with arrow keys and updates the callout', () => {
    const currentSeries = buildCumulative([40, 60, 30, 0, 50])
    const previousSeries = buildCumulative([30, 20, 20, 40, 30])

    render(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: currentSeries,
      previousMonthSeries: previousSeries,
      currentMonthLabel: 'March',
      previousMonthLabel: 'February',
    }))

    const svg = screen.getByRole('img')

    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(screen.getAllByText(/Day 4/).length).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: 'Home' })
    expect(screen.getAllByText(/Day 1/).length).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: 'End' })
    expect(screen.getAllByText(/Day 5/).length).toBeGreaterThan(0)
  })

  it('labels the delta as faster or slower than last month based on the current vs previous endpoint', () => {
    const currentSeries = buildCumulative([100, 100, 100])
    const previousSeries = buildCumulative([50, 50, 50, 50, 50])

    const { container, rerender } = render(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: currentSeries,
      previousMonthSeries: previousSeries,
    }))

    fireEvent.mouseEnter(container.querySelector('.pace-chart__plot'))
    expect(screen.getAllByText(/Faster than last month/).length).toBeGreaterThan(0)

    const slowerCurrent = buildCumulative([25, 25, 25])
    const steadyPrevious = buildCumulative([50, 50, 50, 50, 50])
    rerender(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: slowerCurrent,
      previousMonthSeries: steadyPrevious,
    }))

    fireEvent.mouseEnter(container.querySelector('.pace-chart__plot'))
    expect(screen.getAllByText(/Slower than last month/).length).toBeGreaterThan(0)
  })

  it('provides an aria-label on the svg for accessibility', () => {
    const currentSeries = buildCumulative([40, 60])
    const previousSeries = buildCumulative([30, 20, 40])
    render(React.createElement(PaceVsLastMonthChart, {
      currentMonthSeries: currentSeries,
      previousMonthSeries: previousSeries,
      currentMonthLabel: 'March',
      previousMonthLabel: 'February',
    }))

    expect(screen.getByRole('img', { name: /Cumulative spend March vs February/ })).toBeTruthy()
  })
})
