import type { MetadataRoute } from "next";

import { fetchActiveListingsForSitemap } from "@/lib/listings-queries";
import { SITE_URL } from "@/lib/site-url";

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
  ];

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}/browse/${listing.id}`,
    lastModified: new Date(listing.created_at),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...listingEntries];
}
