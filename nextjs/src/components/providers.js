'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearSession, readSession, writeSession } from '@/lib/session'

const THEME_STORAGE_KEY = 'budgetbuddy.theme'
const AuthContext = createContext(null)
const ThemeContext = createContext(null)
const DataChangedContext = createContext(null)

function setDocumentTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
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

  useEffect(() => {
    setSession(readSession())
    setIsReady(true)
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
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    isReady,
    isAuthenticated: Boolean(session?.accessToken),
    setSessionFromAuthResponse,
    logout,
  }), [isReady, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function DataChangedProvider({ children }) {
  const [token, setToken] = useState(0)

  const notifyDataChanged = useCallback(() => {
    setToken((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ dataChangedToken: token, notifyDataChanged }), [token, notifyDataChanged])

  return <DataChangedContext.Provider value={value}>{children}</DataChangedContext.Provider>
}

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataChangedProvider>{children}</DataChangedProvider>
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



export function useDataChanged() {
  const context = useContext(DataChangedContext)
  if (!context) throw new Error('useDataChanged must be used within AppProviders')
  return context
}
