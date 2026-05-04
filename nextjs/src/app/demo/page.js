'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoPage() {
  const router = useRouter()

  useEffect(() => {
    try {
      window.localStorage.setItem('budgetbuddy.data-mode', 'sample')
    } catch {}
    router.replace('/dashboard')
  }, [router])

  return null
}
