'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearSession, readSession, writeSession } from '@/lib/session'

const THEME_STORAGE_KEY = 'budgetbuddy.theme'
const DATA_MODE_STORAGE_KEY = 'budgetbuddy.data-mode'
const AuthContext = createContext(null)
const ThemeContext = createContext(null)
const DataModeContext = createContext(null)
const DataChangedContext = createContext(null)

function setDocumentTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

function readStoredDataMode() {
  try {
    return window.localStorage.getItem(DATA_MODE_STORAGE_KEY) === 'sample' ? 'sample' : 'live'
  } catch {
    return 'live'
  }
}

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
      setThemeState(storedTheme)
      setDocumentTheme(storedTheme)
    } catch {
      setThemeState('light')
      setDocumentTheme('light')
    }
  }, [])

  const setTheme = (nextTheme) => {
    const safeTheme = nextTheme === 'dark' ? 'dark' : 'light'
    setThemeState(safeTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme)
    } catch {}
    setDocumentTheme(safeTheme)
  }

  const value = useMemo(() => ({
    theme,
    setTheme,
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    setSession(readSession())
    setIsReady(true)
  }, [])

  const refreshProfile = useCallback(async (accessToken) => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/profile', {
        headers: { authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setProfileName(data.name ?? '')
      if (data.email) {
        setSession((prev) => {
          if (!prev || prev.user?.email === data.email) return prev
          const updated = { ...prev, user: { ...prev.user, email: data.email } }
          try { writeSession({ accessToken: prev.accessToken, user: updated.user }) } catch {}
          return updated
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (session?.accessToken) refreshProfile(session.accessToken)
  }, [session?.accessToken, refreshProfile])

  const updateProfileName = useCallback((name) => setProfileName(name ?? ''), [])

  const updateEmail = useCallback((email) => {
    if (!email) return
    setSession((prev) => {
      if (!prev || prev.user?.email === email) return prev
      const updated = { ...prev, user: { ...prev.user, email } }
      try { writeSession({ accessToken: prev.accessToken, user: updated.user }) } catch {}
      return updated
    })
  }, [])

  const setSessionFromAuthResponse = (responseBody) => {
    const nextSession = writeSession({
      accessToken: responseBody?.access_token,
      user: responseBody?.user,
    })

    if (!nextSession) return null
    setSession(nextSession)
    return nextSession
  }

  const logout = () => {
    clearSession()
    setSession(null)
    setProfileName('')
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    isReady,
    isAuthenticated: Boolean(session?.accessToken),
    profileName,
    refreshProfile: () => refreshProfile(session?.accessToken),
    updateProfileName,
    updateEmail,
    setSessionFromAuthResponse,
    logout,
  }), [isReady, session, profileName, refreshProfile, updateProfileName, updateEmail])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function DataModeProvider({ children }) {
  const [mode, setModeState] = useState('live')
  const [isDataModeReady, setIsDataModeReady] = useState(false)

  useEffect(() => {
    setModeState(readStoredDataMode())
    setIsDataModeReady(true)
  }, [])

  const setMode = useCallback((nextMode) => {
    const safeMode = nextMode === 'sample' ? 'sample' : 'live'
    setModeState(safeMode)
    try {
      window.localStorage.setItem(DATA_MODE_STORAGE_KEY, safeMode)
    } catch {}
  }, [])

  const value = useMemo(() => ({
    mode,
    isSampleMode: mode === 'sample',
    isDataModeReady,
    setMode,
  }), [mode, isDataModeReady, setMode])

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>
}

function DataChangedProvider({ children }) {
  const [token, setToken] = useState(0)

  const notifyDataChanged = useCallback(() => {
    setToken((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ dataChangedToken: token, notifyDataChanged }), [token, notifyDataChanged])

  return <DataChangedContext.Provider value={value}>{children}</DataChangedContext.Provider>
}

export { AuthProvider }

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataModeProvider>
          <DataChangedProvider>{children}</DataChangedProvider>
        </DataModeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AppProviders')
  return context
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within AppProviders')
  return context
}

export function useDataMode() {
  const context = useContext(DataModeContext)
  if (!context) throw new Error('useDataMode must be used within AppProviders')
  return context
}

export function useDataChanged() {
  const context = useContext(DataChangedContext)
  if (!context) throw new Error('useDataChanged must be used within AppProviders')
  return context
}
