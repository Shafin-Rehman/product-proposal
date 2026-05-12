/** @jest-environment jsdom */

jest.mock('@/components/planner-view', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'planner-view-stub' }, 'planner'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const PlannerPage = require('@/app/(app)/planner/page').default

it('planner route mounts PlannerView', () => {
  render(React.createElement(PlannerPage, { searchParams: {} }))
  expect(screen.getByTestId('planner-view-stub').textContent).toContain('planner')
})
