import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getFixtureListing } from "../../../../admin-fixtures";
import { StatusPill } from "../../../../StatusPill";

import { AdminListingEditForm } from "./AdminListingEditForm";

import type { Metadata } from "next";

type AdminListingEditPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: AdminListingEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = getFixtureListing(id);
  return {
    title: listing ? `Edit · ${listing.title}` : "Edit listing",
    robots: { index: false, follow: false },
  };
}

export default async function AdminListingEditPage({
  params,
}: AdminListingEditPageProps) {
  const { id } = await params;
  const listing = getFixtureListing(id);
  if (!listing) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
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
      </header>

      <AdminListingEditForm
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          location: listing.location,
          condition: listing.condition,
          category: listing.category,
          color: listing.color,
          contact_email: listing.contact_email,
          contact_phone: listing.contact_phone,
        }}
      />
    </div>
  );
}
