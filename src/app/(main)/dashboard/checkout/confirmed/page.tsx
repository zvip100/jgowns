import { BadgeCheck, CircleAlert, Clock } from 'lucide-react';

import NoticePanel from '@/components/NoticePanel';
import { isValidUUID } from '@/lib/utils';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Payment Confirmation",
  description: "Confirming your listing publishing fee payment.",
  robots: { index: false, follow: false },
};

type ConfirmedPageProps = {
  searchParams: Promise<{ outcome?: string; listing?: string }>;
};

export default async function CheckoutConfirmedPage({
  searchParams,
}: ConfirmedPageProps) {
  const { outcome, listing } = await searchParams;

  if (outcome === 'paid' && listing && isValidUUID(listing)) {
    return (
      <NoticePanel
        icon={BadgeCheck}
        title='Payment received'
        description='Your listing is now live.'
        href={`/browse/${listing}`}
        linkLabel='View listing'
        secondaryHref='/dashboard'
        secondaryLinkLabel='Back to dashboard'
      />
    );
  }

  if (outcome === 'processing') {
    return (
      <NoticePanel
        icon={Clock}
        title='Confirming your payment'
        description="This may take a moment. Check your dashboard shortly."
        href='/dashboard'
        linkLabel='Back to dashboard'
      />
    );
  }

  return (
    <NoticePanel
      icon={CircleAlert}
      title="We couldn't confirm your payment"
      description='Check your dashboard for the current status of your listing.'
      href='/dashboard'
      linkLabel='Back to dashboard'
    />
  );
}
