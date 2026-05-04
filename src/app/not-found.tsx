import Link from 'next/link'

export default function NotFound() {
  return (
    <div className='mx-auto mt-16 max-w-md text-center sm:mt-24'>
      <div className='surface-panel hairline stagger-rise rounded-[1.7rem] p-8 sm:p-10'>
        <p className='mb-4 text-6xl'>👗</p>
        <h2 className='text-[1.6rem] text-[#2f241b]'>Page Not Found</h2>
        <p className='mt-2 text-sm text-[#7d6652]'>Could not find the page you were looking for.</p>
        <Link
          href='/'
          className='mt-6 inline-flex w-full items-center justify-center rounded-full border border-[#b58d5f]/70 bg-[linear-gradient(180deg,#c49a68,#a67841)] py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(106,74,39,0.25)] hover:-translate-y-0.5 hover:brightness-105'
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
