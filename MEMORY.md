# MEMORY.md

Shared agent memory for the JGowns project. Read this before every task.

Entries are append-only. Only the user may request deletions.
Format: `- [MM-DD-YYYY] <category>: <description>`
Categories: `decision` | `completed` | `never`

---

## Decisions

- [05-28-2026] decision: All test files live in project-root `tests/` (e.g. `tests/gown-sizes.test.ts`). Do not colocate `*.test.ts` under `src/`.

- [06-08-2026] decision: Lightbox dialog preloads non-active carousel slides via loading="eager" to avoid the blur-placeholder flash when swiping; the hero (ImageViewer) stays lazy so visitors who don't swipe the inline carousel don't download unused photos. First/active slide keeps priority for LCP (don't set both priority and loading on one image).

## Completed

- [06-01-2026] completed: Fixed invalid listing ID showing error page — UUID guard in browse/[id]/page.tsx + dedicated not-found.tsx for that route

- [06-01-2026] completed: Added per-page metadata across all routes — root layout has title template + OG/twitter base; listing detail uses generateMetadata with fetchListingWithFallback; login/register pages were split into server page + client form component to allow metadata export; dashboard/edit are noindex; register/new are indexed

- [06-04-2026] completed: Multi-image listings (1–3 per listing) — image_urls[]/image_blur_data_urls[] columns, per-slot client-orchestrated upload (optimizeListingPhoto per file), two-column ImageViewer (Embla + Dialog) with swipe/zoom, commit-on-save edit reconcile.

- [06-07-2026] completed: Split ImageViewer.tsx into ImageViewer.tsx (hero) + Lightbox.tsx (dialog shell + private LightboxContent). LightboxContent mounts fresh on each open so embla/zoom/pan self-init at startIndex (dialog effects 4→2). Hero keeps its original reset logic (heroInitRef + reset-to-0-on-mount + scrollTo(0) effects); do NOT replace it with a key on the call site — Cache Components preserves the segment across navigation, so the explicit reset effects are required to return to image 0 and keep heroIndex synced with embla. Extracted blurProps to src/lib/utils.ts, reused in ImageViewer/Lightbox/GownCard/ListingRow.

- [06-09-2026] completed: Multi-image code review applied — slot contract centralized in types.ts (MAX_LISTING_IMAGES + imageSlotFormKeys), createListing validates slots before uploading, blur_N sanitized server-side (data:image/ prefix, 4096 cap), per-slot request-token guard in useListingImageSlots, parallel uploads via Promise.allSettled, deleted unused ui/carousel.tsx and deleteListingImage (singular), migration 008 adds image-array check constraint.

## Never

- [05-28-2026] never: Do not add runtime legacy/backfill/migration-bridge logic (inferring missing fields, aliasing old formats, guessing from partial data) unless the user explicitly asks. Assume the DB and APIs are on the current schema.
