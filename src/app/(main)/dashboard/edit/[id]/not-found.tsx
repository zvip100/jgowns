import type { Metadata } from 'next'
import { SearchX } from 'lucide-react'

import NoticePanel from '@/components/NoticePanel'

export const metadata: Metadata = {
  title: "Listing Not Found",
  description: "This listing doesn't exist or has been removed.",
  robots: { index: false },
}

export default function EditListingNotFound() {
  return (
    <NoticePanel
      icon={SearchX}
      title='Listing Not Found'
      description="This listing doesn't exist or has been removed."
      href='/dashboard'
      linkLabel='Back to dashboard'
    />
  )
}
