/** @jest-environment jsdom */

jest.mock('@/components/insights-view', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'insights-view-stub' }, 'insights'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const InsightsPage = require('@/app/(app)/insights/page').default

it('insights route mounts InsightsView', () => {
  render(React.createElement(InsightsPage))
  expect(screen.getByTestId('insights-view-stub').textContent).toContain('insights')
})
