/** @jest-environment jsdom */

jest.mock('next/font/google', () => ({
  Manrope: () => ({ className: 'font-manrope-mock' }),
}))

jest.mock('@/components/providers', () => ({
  AppProviders: ({ children }) => {
    const React = require('react')
    return React.createElement('div', { 'data-testid': 'app-providers' }, children)
  },
}))

const React = require('react')
const { render, screen } = require('@testing-library/react')
const RootLayout = require('@/app/layout').default

function runThemeScript(container) {
  const script = container.querySelector('script')
  const runThemeBootstrap = new Function(script.textContent)
  runThemeBootstrap()
}

describe('RootLayout', () => {
  it('wraps children in AppProviders, font class, and lang', () => {
    const child = React.createElement('span', null, 'child')
    const { container } = render(React.createElement(RootLayout, { children: child }))
    expect(screen.getByTestId('app-providers').textContent).toBe('child')
    expect(container.querySelector('body')?.className).toContain('font-manrope-mock')
    expect(container.querySelector('html')?.getAttribute('lang')).toBe('en')
  })

  it('theme bootstrap script falls back to light when localStorage throws', () => {
    const { container } = render(React.createElement(RootLayout, { children: React.createElement('span', null, 'x') }))
    expect(container.querySelector('script')?.textContent).toContain('budgetbuddy.theme')
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      runThemeScript(container)
    } finally {
      getItem.mockRestore()
    }
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('theme bootstrap script respects dark in localStorage', () => {
    const { container } = render(React.createElement(RootLayout, { children: React.createElement('span', null, 'x') }))
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('dark')
    try {
      runThemeScript(container)
    } finally {
      getItem.mockRestore()
    }
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
