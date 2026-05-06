'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDataMode } from '@/components/providers'

export default function DemoPage() {
  const router = useRouter()
  const { isSampleMode, setMode } = useDataMode()

  useEffect(() => {
    setMode('sample')
  }, [setMode])

  useEffect(() => {
    if (isSampleMode) router.replace('/dashboard')
  }, [isSampleMode, router])

  return null
}
