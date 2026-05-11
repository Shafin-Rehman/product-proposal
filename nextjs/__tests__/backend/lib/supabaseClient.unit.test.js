describe('supabaseClient specification', () => {
  describe('getSupabaseClient', () => {
    const ORIGINAL_ENV = { ...process.env }

    afterEach(() => {
      process.env = { ...ORIGINAL_ENV }
      jest.resetModules()
    })

    it('throws when Supabase URL and anon key are both missing', () => {
      delete process.env.SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { getSupabaseClient } = require('@/lib/supabaseClient')
      expect(() => getSupabaseClient()).toThrow('Supabase environment variables are required.')
    })

    it('creates a singleton client when env vars are present', () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key'

      const createClient = jest.fn(() => ({ auth: { getUser: jest.fn() } }))
      jest.doMock('@supabase/supabase-js', () => ({ createClient }))

      const { getSupabaseClient } = require('@/lib/supabaseClient')
      const first = getSupabaseClient()
      const second = getSupabaseClient()

      expect(createClient).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
      expect(first.auth.getUser).toEqual(expect.any(Function))
    })
  })

  describe('supabaseClient auth exports', () => {
    const ORIGINAL_ENV = { ...process.env }

    afterEach(() => {
      process.env = { ...ORIGINAL_ENV }
      jest.resetModules()
    })

    function loadWithClient(authHandlers) {
      process.env.SUPABASE_URL = 'https://example.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'test-anon-key'
      const createClient = jest.fn(() => ({ auth: authHandlers }))
      jest.doMock('@supabase/supabase-js', () => ({ createClient }))
      return require('@/lib/supabaseClient')
    }

    it('signUp delegates to the Supabase auth client', async () => {
      const signUp = jest.fn().mockResolvedValue({ user: { id: '1' } })
      const { signUp: signUpApi, getSupabaseClient } = loadWithClient({
        signUp,
        signInWithPassword: jest.fn(),
        getUser: jest.fn(),
      })
      getSupabaseClient()
      const result = await signUpApi('a@example.com', 'pw')

      expect(signUp).toHaveBeenCalledWith({ email: 'a@example.com', password: 'pw' })
      expect(result.user.id).toBe('1')
    })

    it('signIn delegates to password auth', async () => {
      const signInWithPassword = jest.fn().mockResolvedValue({ session: {} })
      const { signIn, getSupabaseClient } = loadWithClient({
        signUp: jest.fn(),
        signInWithPassword,
        getUser: jest.fn(),
      })
      getSupabaseClient()
      await signIn('a@example.com', 'pw')

      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.com', password: 'pw' })
    })

    it('getUser returns null on error and the profile when valid', async () => {
      const getUser = jest.fn()
        .mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
        .mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
      const { getUser: getUserApi, getSupabaseClient } = loadWithClient({
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        getUser,
      })
      getSupabaseClient()
      expect(await getUserApi('t1')).toBeNull()

      expect(await getUserApi('t2')).toEqual({ id: 'u1' })
    })
  })
})
