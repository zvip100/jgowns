'use client'

import ErrorStateCard from '@/components/ErrorStateCard'
import { useReportBoundaryError } from '@/hooks/useReportBoundaryError'

type ErrorProps = {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function Error({
  error,
  unstable_retry,
}: ErrorProps) {
  useReportBoundaryError(error, 'errorBoundary.root')

  return (
    <div className='flex min-h-screen items-center justify-center px-4' role='alert'>
      <ErrorStateCard onRetry={unstable_retry} />
    </div>
  )
}
