import type { MetadataRoute } from "next";

import { fetchActiveListingsForSitemap } from "@/lib/listings-queries";
import { SITE_URL } from "@/lib/site";

// Last real content edit for each static legal/support page (see MEMORY.md
// 07-14-2026 entries) — not request time, so crawlers see an accurate signal
// instead of "just modified" on every sitemap regeneration.
const CONTACT_PAGE_LAST_MODIFIED = new Date("2026-07-14");
const LEGAL_PAGES_LAST_MODIFIED = new Date("2026-07-14");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await fetchActiveListingsForSitemap();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/browse`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: CONTACT_PAGE_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: LEGAL_PAGES_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: LEGAL_PAGES_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}/browse/${listing.id}`,
    lastModified: new Date(listing.created_at),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...listingEntries];
}
