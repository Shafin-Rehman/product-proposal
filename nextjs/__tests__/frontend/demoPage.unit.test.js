/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/components/providers', () => ({
  useDataMode: jest.fn(),
}))

const React = require('react')
const { render, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useDataMode } = require('@/components/providers')
const DemoPage = require('@/app/demo/page').default

let mockReplace
let mockSetMode

beforeEach(() => {
  mockReplace = jest.fn()
  mockSetMode = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace })
  useDataMode.mockReturnValue({ setMode: mockSetMode })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('DemoPage — setMode', () => {
  it('calls setMode("sample") on mount', async () => {
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(mockSetMode).toHaveBeenCalledWith('sample')
  })

  it('calls setMode before redirecting', async () => {
    const callOrder = []
    mockSetMode.mockImplementation(() => callOrder.push('setMode'))
    mockReplace.mockImplementation(() => callOrder.push('replace'))
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(callOrder).toEqual(['setMode', 'replace'])
  })
})

describe('DemoPage — redirect', () => {
  it('calls router.replace("/dashboard") on mount', async () => {
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('renders nothing (returns null)', async () => {
    const { container } = await act(async () => render(React.createElement(DemoPage)))
    expect(container.firstChild).toBeNull()
  })
})
