'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang='en'>
      <body className='flex min-h-screen items-center justify-center bg-[#f5f0e7]'>
        <div className='mx-auto max-w-md px-4 text-center' role='alert'>
          <div className='rounded-[1.7rem] border border-[#d4c2ad] bg-[rgba(255,251,244,0.95)] p-8 shadow-[0_22px_54px_rgba(99,72,40,0.14)] sm:p-10'>
            <div className='mb-4 text-5xl'>⚠️</div>
            <h1 className='mb-2 text-[1.6rem] font-semibold tracking-[-0.02em] text-[#2f241b]'>Something went wrong</h1>
            <p className='text-sm text-[#7d6652]'>An unexpected error occurred.</p>
            <button
              onClick={() => unstable_retry()}
              className='mt-6 w-full rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
