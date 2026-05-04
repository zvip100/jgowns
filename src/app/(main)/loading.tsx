export default function Loading() {
  return (
    <div className='flex items-center justify-center py-24' role='status'>
      <div className='h-10 w-10 animate-spin rounded-full border-4 border-[#d9c9b6] border-t-[#a67841]' />
      <span className='sr-only'>Loading…</span>
    </div>
  )
}
