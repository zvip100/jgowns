# MEMORY.md

Shared agent memory for the JGowns project. Read this before every task.

Entries are append-only. Only the user may request deletions.
Format: `- [MM-DD-YYYY] <category>: <description>`
Categories: `decision` | `completed` | `never`

---

## Decisions

- [05-28-2026] decision: All test files live in project-root `tests/` (e.g. `tests/gown-sizes.test.ts`). Do not colocate `*.test.ts` under `src/`.
## Completed

## Never

- [05-28-2026] never: Do not add runtime legacy/backfill/migration-bridge logic (inferring missing fields, aliasing old formats, guessing from partial data) unless the user explicitly asks. Assume the DB and APIs are on the current schema.
