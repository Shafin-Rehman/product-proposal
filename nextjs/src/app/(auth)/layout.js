'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers'

function AuthRouteLoading({ isRedirecting = false }) {
  return (
    <div className="route-shell-loading">
      <div className="route-shell-loading__glow route-shell-loading__glow--top" />
      <div className="route-shell-loading__glow route-shell-loading__glow--bottom" />
      <section className="route-shell-loading__card surface-card">
        <span className="brand-pill">BudgetBuddy</span>
        <h1>{isRedirecting ? 'One second' : 'Welcome'}</h1>
        <p>
          {isRedirecting
            ? 'We are taking you into your budget space.'
            : 'Checking whether we should take you into the app or keep you on the welcome path.'}
        </p>
      </section>
    </div>
  )
}

export default function AuthLayout({ children }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isReady, isAuthenticated, authReason } = useAuth()
  
  const hasExpiredReason = searchParams.get('reason') === 'expired'

  useEffect(() => {
    if (!isReady || !isAuthenticated || authReason || hasExpiredReason) return
    router.replace('/dashboard')
  }, [isAuthenticated, isReady, router, authReason, hasExpiredReason])

  if (!isReady || isAuthenticated) {
    return <AuthRouteLoading isRedirecting={isReady && isAuthenticated} />
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow auth-shell__glow--left" />
      <div className="auth-shell__glow auth-shell__glow--right" />
      <div className="auth-shell__inner">{children}</div>
    </div>
  )
}
