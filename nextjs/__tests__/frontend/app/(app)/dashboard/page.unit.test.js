/** @jest-environment jsdom */

jest.mock('@/components/dashboard-view', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'dashboard-view-mock' }, 'dashboard'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const DashboardPage = require('@/app/(app)/dashboard/page').default

it('dashboard route mounts DashboardView', () => {
  render(React.createElement(DashboardPage))
  expect(screen.getByTestId('dashboard-view-mock').textContent).toContain('dashboard')
})
