import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAdminListing } from "@/lib/queries/admin/listings";
import { sortListingSizes } from "@/lib/listing-variants";

import { isAdminDemoMode } from "@/lib/admin/demo";
import { AdminRefreshControl } from "../../../../AdminRefreshControl";
import { getFixtureListing } from "../../../../admin-fixtures";
import { StatusPill } from "../../../../StatusPill";

import { AdminListingEditForm } from "./AdminListingEditForm";

import type { Metadata } from "next";
import type { AdminListing } from "@/lib/admin/types";

type AdminListingEditPageProps = {
  params: Promise<{ id: string }>;
};

/** Deduped so generateMetadata and the page body share one read. */
const loadListing = cache(async (id: string): Promise<AdminListing | null> => {
  if (await isAdminDemoMode()) return getFixtureListing(id) ?? null;
  return getAdminListing(id);
});

export async function generateMetadata({
  params,
}: AdminListingEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await loadListing(id);
  return {
    title: listing ? `Edit · ${listing.title}` : "Edit listing",
    robots: { index: false, follow: false },
  };
}

export default async function AdminListingEditPage({
  params,
}: AdminListingEditPageProps) {
  const { id } = await params;
  const isDemo = await isAdminDemoMode();
  const listing = await loadListing(id);
  if (!listing) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/admin/listings/${listing.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--accent-deep) hover:text-(--ink)"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to listing
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[1.75rem] text-(--ink) sm:text-[2rem]">
              Edit listing
            </h1>
            <StatusPill status={listing.status} />
          </div>
          <p className="mt-1 text-sm text-(--muted-ink)">{listing.title}</p>
        </div>
        <AdminRefreshControl />
      </header>

      <AdminListingEditForm
        isDemo={isDemo}
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          location: listing.location,
          condition: listing.condition,
          category: listing.category,
          color: listing.color,
          sell_mode: listing.sell_mode,
          bundle_price: listing.bundle_price,
          contact_email: listing.contact_email,
          contact_phone: listing.contact_phone,
          contact_methods: listing.contact_methods,
          sizes: sortListingSizes(listing.sizes).map(
            ({ size, size_group, price }) => ({ size, size_group, price }),
          ),
        }}
      />
    </div>
  );
}
