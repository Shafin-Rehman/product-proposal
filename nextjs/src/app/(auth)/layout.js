'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, useDataMode } from '@/components/providers'

function AuthRouteLoading() {
  return (
    <div className="route-shell-loading">
      <section className="route-shell-loading__card surface-card">
        <span className="brand-pill">BudgetBuddy</span>
        <p>Checking whether we should take you into the app or keep you on the welcome path.</p>
      </section>
    </div>
  )
}

function isRecoveryUrl(pathname) {
  if (pathname !== '/reset-password') return false
  if (typeof window === 'undefined') return false
  const hash = new URLSearchParams(window.location.hash.slice(1))
  return hash.get('type') === 'recovery' && !!hash.get('access_token')
}

export default function AuthLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isReady, isAuthenticated } = useAuth()
  const { setMode } = useDataMode()

  const isRecovery = isRecoveryUrl(pathname)

  useEffect(() => {
    setMode('live')
  }, [setMode])

  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    if (isRecovery) return
    router.replace('/dashboard')
  }, [isAuthenticated, isReady, router, isRecovery])

  if (!isReady || (isAuthenticated && !isRecovery)) {
    return <AuthRouteLoading />
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow auth-shell__glow--left" />
      <div className="auth-shell__glow auth-shell__glow--right" />
      <div className="auth-shell__inner">{children}</div>
    </div>
  )
}
