"use client";

import { useState } from "react";

import { Lightbox } from "@/components/lightbox/Lightbox";
import { MAX_LISTING_IMAGES } from "@/lib/types";

import { AdminThumbnail } from "../../../AdminThumbnail";
import {
  AdminAddImageButton,
  AdminPhotoMoveButton,
  AdminRemoveImageButton,
  AdminReplaceImageButton,
  AdminReprocessImageButton,
} from "../../../admin-action-buttons";

/**
 * The Photos panel. A client leaf because opening the viewer is a click, and
 * the per-photo controls are already client components.
 *
 * `AdminThumbnail` is deliberately NOT a client component: it is shared with
 * the listings table, and marking it would pull that whole list's thumbnails
 * across the boundary. It has no server-only imports, so rendering it from here
 * is enough.
 */
type AdminPhotoGridProps = {
  listingId: string;
  title: string;
  imageUrls: string[];
  blurDataUrls: string[];
  isDemo: boolean;
};

const THUMBNAIL_SIZE = 184;

export function AdminPhotoGrid({
  listingId,
  title,
  imageUrls,
  blurDataUrls,
  isDemo,
}: AdminPhotoGridProps) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  return (
    <>
      {imageUrls.length === 0 ? (
        <p className="text-sm text-(--muted-ink)">No photos.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-5">
          {imageUrls.map((url, i) => (
            // Keyed by position, not by URL: the same URL can legitimately
            // appear twice in one array, and duplicate React keys would let a
            // move reconcile a card's pending state onto the wrong slot.
            <div key={`${i}-${url}`} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenAt(i)}
                // The thumbnail's own alt is empty, so without this the button
                // would be an unnamed control to a screen reader.
                aria-label={`Open photo ${i + 1} in viewer`}
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
              >
                <AdminThumbnail
                  src={url}
                  blurDataURL={blurDataUrls[i]}
                  alt=""
                  size={THUMBNAIL_SIZE}
                />
              </button>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <AdminPhotoMoveButton
                  listingId={listingId}
                  imageUrl={url}
                  position={i + 1}
                  offset={-1}
                  atEnd={i === 0}
                  isDemo={isDemo}
                />
                <AdminReprocessImageButton
                  listingId={listingId}
                  imageUrl={url}
                  position={i + 1}
                  isDemo={isDemo}
                />
                <AdminReplaceImageButton
                  listingId={listingId}
                  imageUrl={url}
                  position={i + 1}
                  isDemo={isDemo}
                />
                <AdminRemoveImageButton
                  listingId={listingId}
                  imageUrl={url}
                  position={i + 1}
                  isDemo={isDemo}
                />
                <AdminPhotoMoveButton
                  listingId={listingId}
                  imageUrl={url}
                  position={i + 1}
                  offset={1}
                  atEnd={i === imageUrls.length - 1}
                  isDemo={isDemo}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {imageUrls.length < MAX_LISTING_IMAGES && (
        <div className="mt-5">
          <AdminAddImageButton listingId={listingId} isDemo={isDemo} />
        </div>
      )}

      {openAt !== null && (
        <Lightbox
          open
          onOpenChange={(next) => {
            if (!next) setOpenAt(null);
          }}
          imageUrls={imageUrls}
          blurDataUrls={blurDataUrls}
          title={title}
          startIndex={openAt}
          variant="inspector"
        />
      )}
    </>
  );
}
