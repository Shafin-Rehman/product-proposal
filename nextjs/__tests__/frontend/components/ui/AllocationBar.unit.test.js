/** @jest-environment jsdom */

const React = require('react')
const { render, screen, cleanup } = require('@testing-library/react')
const { default: AllocationBar } = require('@/components/ui/AllocationBar')

afterEach(() => {
  cleanup()
})

describe('AllocationBar', () => {
  it('renders a progressbar with the rounded progress value', () => {
    render(React.createElement(AllocationBar, {
      progressPercentage: 42.7,
      tone: 'positive',
      ariaLabel: 'Monthly spend progress',
    }))

    const bar = screen.getByRole('progressbar', { name: 'Monthly spend progress' })
    expect(bar.getAttribute('aria-valuenow')).toBe('43')
    expect(bar.className).toContain('allocation-bar--positive')
  })

  it('clamps progress values above 100 to 100', () => {
    render(React.createElement(AllocationBar, {
      progressPercentage: 250,
      tone: 'danger',
      isOverBudget: true,
    }))

    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
    expect(bar.className).toContain('allocation-bar--over')
  })

  it('places a day-of-month marker when activeDay and monthLength are provided', () => {
    render(React.createElement(AllocationBar, {
      progressPercentage: 30,
      monthLength: 30,
      activeDay: 15,
      monthMarkerLabel: 'Day 15 of 30',
    }))

    const marker = screen.getByTestId('allocation-bar-marker')
    expect(marker.getAttribute('style')).toContain('50%')
    expect(marker.getAttribute('title')).toBe('Day 15 of 30')
  })

  it('hides the marker when showMarker is false', () => {
    render(React.createElement(AllocationBar, {
      progressPercentage: 30,
      monthLength: 30,
      activeDay: 15,
      showMarker: false,
    }))

    expect(screen.queryByTestId('allocation-bar-marker')).toBeNull()
  })

  it('hides the marker when monthLength or activeDay is missing', () => {
    const { rerender } = render(React.createElement(AllocationBar, {
      progressPercentage: 30,
      monthLength: 0,
      activeDay: 15,
    }))
    expect(screen.queryByTestId('allocation-bar-marker')).toBeNull()

    rerender(React.createElement(AllocationBar, {
      progressPercentage: 30,
      monthLength: 30,
      activeDay: 0,
    }))
    expect(screen.queryByTestId('allocation-bar-marker')).toBeNull()
  })

  it('sets aria-valuetext when provided', () => {
    render(React.createElement(AllocationBar, {
      progressPercentage: 80,
      tone: 'warning',
      ariaLabel: 'Spent of budget',
      ariaValueText: '80% used, $200 left',
    }))

    const bar = screen.getByRole('progressbar', { name: 'Spent of budget' })
    expect(bar.getAttribute('aria-valuetext')).toBe('80% used, $200 left')
  })
})
