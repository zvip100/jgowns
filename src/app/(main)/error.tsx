'use client'

import { useEffect } from 'react'

import ErrorStateCard from '@/components/ErrorStateCard'

type MainErrorProps = {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function MainError({
  error,
  unstable_retry,
}: MainErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4 py-10' role='alert'>
      <ErrorStateCard onRetry={unstable_retry} />
    </div>
  )
}
