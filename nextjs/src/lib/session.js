import { SESSION_STORAGE_KEY, DATA_MODE_STORAGE_KEY } from './constants'

const pickUser = (user) => {
  if (!user?.id || !user?.email) return null
  return {
    id: user.id,
    email: user.email,
  }
}

export function readSession() {
  if (typeof window === 'undefined') return null

  try {
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!storedSession) return null

    const parsedSession = JSON.parse(storedSession)
    const user = pickUser(parsedSession?.user)

    if (!parsedSession?.accessToken || !user) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    return {
      accessToken: parsedSession.accessToken,
      user,
    }
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function writeSession({ accessToken, user }) {
  if (typeof window === 'undefined') return null

  const safeUser = pickUser(user)
  if (!accessToken || !safeUser) return null

  const nextSession = {
    accessToken,
    user: safeUser,
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession))
  return nextSession
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.removeItem(DATA_MODE_STORAGE_KEY)
}
