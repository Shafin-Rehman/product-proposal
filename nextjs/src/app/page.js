'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'

export default function Home() {
  const router = useRouter()
  const { isReady, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isReady) return
    router.replace(isAuthenticated ? '/dashboard' : '/login')
  }, [isAuthenticated, isReady, router])

  return (
    <main className="launch-screen" aria-busy="true">
      <div className="launch-screen__glow launch-screen__glow--left" />
      <div className="launch-screen__glow launch-screen__glow--right" />
      <section className="launch-card">
        <span className="brand-pill">BudgetBuddy</span>
        <h1 className="launch-card__title">Setting up your calm money space.</h1>
        <p className="launch-card__copy">
          We&apos;re checking your session and taking you to the right starting point.
        </p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  )
}
