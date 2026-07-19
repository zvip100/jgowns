import { SearchX } from 'lucide-react'
import Link from 'next/link'

import Footer from '@/components/Footer'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className='flex min-h-svh flex-col'>
      <main className='flex flex-1 items-center justify-center px-4 py-16'>
        <div className='w-full max-w-md text-center'>
          <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
            <SearchX className='mx-auto mb-4 size-12 text-[#8a7462]' />
            <h1 className='text-[1.6rem] text-[#2f241b]'>Page Not Found</h1>
            <p className='mt-2 text-sm text-[#7d6652]'>Could not find the page you were looking for.</p>
            <Link
              href='/browse'
              className='mt-6 inline-flex w-full items-center justify-center rounded-full border border-[#b58d5f]/70 gold-gradient py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
            >
              Browse all gowns
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
