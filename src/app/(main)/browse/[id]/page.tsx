import { notFound } from "next/navigation";

import { browseHrefFromBack } from "@/lib/browse-url";
import {
  listingPriceSummary,
  listingSizeSummary,
} from "@/lib/listing-variants";
import { fetchListing } from "@/lib/queries/listings";
import { isValidUUID } from "@/lib/utils";

import { ListingDetail } from "./ListingDetail";

import type { Metadata } from "next";

type ListingPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; from?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isValidUUID(id)) return { title: "Listing Not Found" };

  const { listing, error } = await fetchListing(id);
  if (error) return { title: "Something went wrong" };
  if (!listing) return { title: "Listing Not Found" };

  const price = listingPriceSummary(listing);
  const details = [
    listingSizeSummary(listing),
    listing.condition,
    listing.location,
  ].filter(Boolean).join(" · ");

  const description = listing.description
    ? `${listing.description.slice(0, 120).trimEnd().replace(/[.!?]+$/, "")}. ${details}`
    : `${listing.title}. ${details}`;

  const primaryImage = listing.image_urls[0];

  return {
    title: listing.title,
    description,
    openGraph: {
      title: `${listing.title}, ${price}`,
      description: details,
      images: primaryImage ? [{ url: primaryImage, alt: listing.title }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.title}, ${price}`,
      description: details,
      images: primaryImage ? [primaryImage] : [],
    },
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: ListingPageProps) {
  const [{ id }, { back, from }] = await Promise.all([params, searchParams]);

  if (!isValidUUID(id)) notFound();

  const fromDashboard = from === 'dash';
  const backHref = fromDashboard ? '/dashboard' : browseHrefFromBack(back);
  const backLabel = fromDashboard ? 'Back to dashboard' : 'Browse all gowns';

  const { listing, error } = await fetchListing(id);
  if (error) throw new Error(error.message);
  if (!listing) notFound();

  return (
    <ListingDetail listing={listing} backHref={backHref} backLabel={backLabel} />
  );
}
