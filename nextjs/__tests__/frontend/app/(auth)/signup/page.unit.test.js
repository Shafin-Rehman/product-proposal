/** @jest-environment jsdom */

jest.mock('@/components/auth-form', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'auth-form-stub' }, 'signup'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const SignupPage = require('@/app/(auth)/signup/page').default

it('signup route mounts AuthForm', () => {
  render(React.createElement(SignupPage))
  expect(screen.getByTestId('auth-form-stub').textContent).toContain('signup')
})
