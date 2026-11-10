'use client'

import ErrorStateCard from '@/components/ErrorStateCard'
import { useReportBoundaryError } from '@/hooks/useReportBoundaryError'

type MainErrorProps = {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function MainError({
  error,
  unstable_retry,
}: MainErrorProps) {
  useReportBoundaryError(error, 'errorBoundary.main')

  return (
    <div className='flex min-h-[60vh] items-center justify-center px-4 py-10' role='alert'>
      <ErrorStateCard onRetry={unstable_retry} />
    </div>
  )
}
