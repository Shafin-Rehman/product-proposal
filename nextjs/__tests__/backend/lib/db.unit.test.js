const ORIGINAL_ENV = { ...process.env }

describe('db specification', () => {
  describe('db pool', () => {
    const mockQuery = jest.fn()

    afterEach(() => {
      process.env = { ...ORIGINAL_ENV }
      jest.resetModules()
      jest.clearAllMocks()
    })

    it('configures pg with SSL disabled for localhost URLs', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/app'

      const setDefaultResultOrder = jest.fn()
      jest.doMock('dns', () => ({ setDefaultResultOrder }))
      const Pool = jest.fn().mockImplementation(() => ({ query: mockQuery }))
      jest.doMock('pg', () => ({ Pool }))

      require('@/lib/db')

      expect(setDefaultResultOrder).toHaveBeenCalledWith('ipv4first')
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://localhost:5432/app',
        ssl: false,
      })
    })

    it('enables SSL for non-local connection strings', () => {
      process.env.DATABASE_URL = 'postgresql://db.example.com:5432/app'

      jest.doMock('dns', () => ({ setDefaultResultOrder: jest.fn() }))
      const Pool = jest.fn().mockImplementation(() => ({ query: mockQuery }))
      jest.doMock('pg', () => ({ Pool }))

      require('@/lib/db')

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://db.example.com:5432/app',
        ssl: { rejectUnauthorized: false },
      })
    })
  })
})
