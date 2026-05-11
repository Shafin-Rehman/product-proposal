/** @jest-environment jsdom */

jest.mock('@/components/reset-password-form', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'reset-password-stub' }, 'reset'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const ResetPasswordPage = require('@/app/(auth)/reset-password/page').default

it('reset-password route mounts ResetPasswordForm', () => {
  render(React.createElement(ResetPasswordPage))
  expect(screen.getByTestId('reset-password-stub').textContent).toContain('reset')
})
