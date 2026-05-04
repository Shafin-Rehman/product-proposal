'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDataMode } from '@/components/providers'

export default function DemoPage() {
  const router = useRouter()
  const { setMode } = useDataMode()

  useEffect(() => {
    setMode('sample')
    router.replace('/dashboard')
  }, [router, setMode])

  return null
}
