/** @jest-environment jsdom */

const React = require('react')
const { render, cleanup } = require('@testing-library/react')
const { default: TrendChartAxes } = require('@/components/ui/TrendChartAxes')

afterEach(() => {
  cleanup()
})

function renderInSvg(ui) {
  return render(React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, ui))
}

describe('TrendChartAxes', () => {
  it('renders null when axes are missing', () => {
    const { container } = renderInSvg(React.createElement(TrendChartAxes, { axes: null }))
    expect(container.querySelector('g')).toBeNull()
  })

  it('renders the budget and pace lines when the axes object includes them', () => {
    const { container } = renderInSvg(React.createElement(TrendChartAxes, {
      axes: {
        budgetLineY: 24,
        plotLeft: 10,
        plotRight: 300,
        paceLine: { startX: 10, endX: 280, startY: 100, endY: 20 },
      },
    }))

    const group = container.querySelector('g.trend-chart__axes')
    expect(group).toBeTruthy()
    expect(group.querySelector('.trend-chart__budget-line')).toBeTruthy()
    expect(group.querySelector('.trend-chart__pace-line')).toBeTruthy()
  })

  it('renders only the budget line when pace is absent', () => {
    const { container } = renderInSvg(React.createElement(TrendChartAxes, {
      axes: { budgetLineY: 20, plotLeft: 0, plotRight: 200, paceLine: null },
    }))

    const group = container.querySelector('g.trend-chart__axes')
    expect(group.querySelector('.trend-chart__budget-line')).toBeTruthy()
    expect(group.querySelector('.trend-chart__pace-line')).toBeNull()
  })
})
