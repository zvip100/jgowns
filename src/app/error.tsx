'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className='flex min-h-screen items-center justify-center px-4' role='alert'>
      <div className='w-full max-w-md text-center'>
        <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
          <div className='mb-4 text-5xl'>⚠️</div>
          <h2 className='text-[1.6rem] text-[#2f241b]'>Something went wrong</h2>
          <p className='mt-2 text-sm text-[#7d6652]'>An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => unstable_retry()}
            className='mt-6 w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
          >
            Try Again
          </button>
          <Link
            href='/browse'
            className='mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#d4c2ad] bg-white/70 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5a4738] hover:bg-white'
          >
            Browse all gowns
          </Link>
        </div>
      </div>
    </div>
  )
}
