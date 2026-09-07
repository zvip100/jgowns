'use client';

import { useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics/client';
import { BUYER_EVENTS } from '@/lib/analytics/events';

import type { ListingViewProperties } from '@/lib/analytics/events';

type ListingViewTrackerProps = {
  properties: ListingViewProperties;
  isSold: boolean;
};

/**
 * The detail page is a Server Component, so the view event needs a client leaf.
 * A sold gown fires both events: `listing_viewed` stays the honest count of
 * every detail view, and `sold_listing_viewed` marks the subset that reached a
 * gown they can no longer buy.
 */
export function ListingViewTracker({
  properties,
  isSold,
}: ListingViewTrackerProps) {
  const capturedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (capturedIdRef.current === properties.listing_id) return;
    capturedIdRef.current = properties.listing_id;

    captureEvent(BUYER_EVENTS.listingViewed, properties);

    if (isSold) {
      captureEvent(BUYER_EVENTS.soldListingViewed, {
        listing_id: properties.listing_id,
        category: properties.category,
        price: properties.price,
      });
    }
  }, [properties, isSold]);

  return null;
}
