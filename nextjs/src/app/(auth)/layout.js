'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'

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

export default function AuthLayout({ children }) {
  const router = useRouter()
  const { isReady, isAuthenticated } = useAuth()
  const [isRecovery] = useState(() => {
    if (typeof window === 'undefined') return false
    const hash = new URLSearchParams(window.location.hash.slice(1))
    return hash.get('type') === 'recovery' && !!hash.get('access_token')
  })

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
