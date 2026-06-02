# MEMORY.md

Shared agent memory for the JGowns project. Read this before every task.

Entries are append-only. Only the user may request deletions.
Format: `- [MM-DD-YYYY] <category>: <description>`
Categories: `decision` | `completed` | `never`

---

## Decisions

- [05-28-2026] decision: All test files live in project-root `tests/` (e.g. `tests/gown-sizes.test.ts`). Do not colocate `*.test.ts` under `src/`.

## Completed

- [06-01-2026] completed: Fixed invalid listing ID showing error page — UUID guard in browse/[id]/page.tsx + dedicated not-found.tsx for that route

- [06-01-2026] completed: Added per-page metadata across all routes — root layout has title template + OG/twitter base; listing detail uses generateMetadata with fetchListingWithFallback; login/register pages were split into server page + client form component to allow metadata export; dashboard/edit are noindex; register/new are indexed

## Never

- [05-28-2026] never: Do not add runtime legacy/backfill/migration-bridge logic (inferring missing fields, aliasing old formats, guessing from partial data) unless the user explicitly asks. Assume the DB and APIs are on the current schema.
