# Project Rules

Read this file before every change.

---

## Project Context

**App:** JGowns — a wedding gown marketplace.

**Core flow:**

1. Seller creates an account and signs in.
2. Seller lists a gown with: size, category, location, price, photos, and contact info.
3. Buyer browses listings and contacts the seller directly.

No in-app transactions yet. Stripe is planned but **not implemented** — do not add or scaffold it until explicitly asked.

**Stack:**

- **Framework:** Next.js App Router (latest)
- **Auth / DB / Storage:** Supabase — use the official Supabase TypeScript client (`@supabase/supabase-js`, `@supabase/ssr`) for all auth, database queries, and file storage. No ORM.
- **Image pipeline (server-side):** Google Vision API (face detection) → Sharp (blur faces, crop, convert to WebP, optimize). All image processing runs on the server.
- **Styling:** Tailwind CSS v4 — strictly follow v4 syntax and conventions. Do not use v3 patterns.
- **Component library:** shadcn/ui
- **Icons:** `lucide-react`
- **Payments:** Stripe — planned, not active. Do not touch until asked.

**Developer:** Junior full-stack developer. Briefly explain reasoning when introducing a non-obvious approach or pattern.

---

## Agent Behavior

- **Do only what's asked.** No extra changes, no unsolicited refactors, no unrequested suggestions.
- **Clarify before acting** on anything ambiguous or underspecified.
- **Confirm before destructive changes** (deleting files, removing logic, breaking APIs).
- **When multiple valid approaches exist**, list them briefly and wait for approval before writing code.
- **Always choose the simplest, cleanest, best-practice solution.** Don't over-engineer.
- **Responses mirror the task.** Simple question → short answer. Complex task → full but concise. No filler phrases.
- **No over-commenting.** A single JSDoc-style comment above a complex function is fine. Never comment above random lines, never write paragraph-style comments in code. If a file being modified has excessive comments, remove or trim them as part of the task.

---

## 1. Server-First

Everything that can run on the server must. A component is a Server Component unless it physically cannot be.

**Only add `"use client"` if the file actually uses:**

- React hooks (`useState`, `useEffect`, `useRef`, `useReducer`, `useContext`, or custom hooks wrapping any of these)
- DOM event handlers (`onClick`, `onChange`, `onSubmit`, etc.)
- Browser-only APIs (`window`, `document`, `localStorage`, etc.)
- Third-party libraries that require the client

**Push `"use client"` as far down the tree as possible.** Extract only the interactive leaf — never make a whole page a Client Component for one input.

**Data fetching:** fetch in Server Components, `page.tsx`, `layout.tsx`, or route handlers. Never in `useEffect` if a server fetch would work.

---

## 2. Caching

Use `next/cache`. No hand-rolled in-memory caches.

**Reads — `"use cache"` + `cacheLife` + `cacheTag`:**

```ts
// src/lib/queries/listings.ts
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getListings(filters: ListingFilters) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings");
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("*").match(filters);
  return data;
}

export async function getListingById(id: string) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings", `listing:${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}
```

- **Public data** (listings, filters, pagination): always cache with the default policy: `cacheLife({ stale: 60, revalidate: 3600, expire: 86400 })`.
- **User-specific data**: never cache. Fetch fresh on every request.
- Always tag reads. Use a collection tag (`"listings"`) + per-entity tag (`` `listing:${id}` ``).
- Never cache functions that read `cookies()`, `headers()`, or `searchParams` — pass those as arguments instead.

**Writes — invalidate after every mutation:**

```ts
// src/lib/actions/sell.ts
import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateListing(id: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.from("listings").update(parseListing(formData)).eq("id", id);
  updateTag(`listing:${id}`);
  updateTag("listings");
}
```

- `updateTag` — immediate invalidation. **Prefer this** in server actions.
- `revalidateTag(tag, "max")` — use when a brief stale delay is acceptable.
- `revalidatePath` — last resort only, when tags are unknown.
- Every CRUD action invalidates at least one tag. Tag names are a contract between reads and writes — keep them consistent.

---

## 3. Server Actions

All server actions live in `src/lib/actions/`, grouped by domain.

```
src/lib/actions/
  auth.ts       ← sign in / up / out, password reset
  listings.ts   ← query, filter, search, paginate
  sell.ts       ← create / edit / delete listing
  profile.ts    ← profile + settings
```

- Every action file starts with `"use server";` on line 1. No exceptions.
- Group by domain — not by individual function. `listings-search.ts` is wrong; `listings.ts` is right.
- Validate all input (e.g. with zod) before touching the DB or any external service.
- Call `revalidateTag` / `redirect` from inside the action after a successful mutation.
- Export only server actions and their types/schemas. No UI, no client utilities.

**Read-only data fetchers** (server-side only, never called from the client) live in `src/lib/queries/`, grouped by domain. Currently `src/lib/` may have flat query files — as the project grows, move them into this folder.

---

## 4. TypeScript

- No `any`. Use `unknown` and narrow, or define a proper type.
- All function parameters and return types are explicitly typed.
- Prefer `type` over `interface` unless declaration merging is needed.
- No `as` casts unless unavoidable — add a comment explaining why if used.
- Use `satisfies` to validate object shapes without widening the type.

---

## 5. Naming Conventions

| Thing                 | Convention           | Example                         |
| --------------------- | -------------------- | ------------------------------- |
| Components            | PascalCase           | `ListingCard`, `FilterInput`    |
| Component files       | PascalCase           | `ListingCard.tsx`               |
| Util / action files   | kebab-case           | `listings.ts`, `sell.ts`        |
| Variables & functions | camelCase            | `getListings`, `listingId`      |
| Types & interfaces    | PascalCase           | `ListingFilters`, `UserProfile` |
| Constants             | SCREAMING_SNAKE_CASE | `MAX_UPLOAD_SIZE`               |
| Boolean vars / props  | `is` / `has` prefix  | `isLoading`, `hasError`         |

---

## 6. Import Order

Separate each group with a blank line:

1. Node built-ins
2. External packages (React, Next.js, third-party)
3. Internal aliases (`@/lib/...`, `@/components/...`)
4. Relative imports (`./`, `../`)
5. Type-only imports (`import type ...`)

---

## 7. Error Handling

- **Server actions:** return a typed result object (`{ success, error }`) — never throw to the client.
- **Server Components:** use `error.tsx` boundaries for unexpected errors; handle expected errors (not found, unauthorized) in the component.
- **Route handlers:** always return typed JSON with an appropriate HTTP status code.
- Never swallow errors silently (`catch (e) {}`).
- Log errors server-side; return a sanitized message to the client.

---

## 8. Next.js Version & Skills

This project runs the **latest Next.js** (currently v16+). Do not rely on training data for Next.js APIs, conventions, or behavior — it may be outdated.

Before writing any Next.js-related code:

1. Check `node_modules/next/dist/docs/` for the current API and conventions.
2. Use the `next-best-practices` skill (Vercel). Always load all available skills relevant to the task.
3. Heed any deprecation notices found in those sources.

---

## 9. Code Quality

### Components & reuse

- Before building a new component: check `src/components/` for an existing one, and check if it can be installed via `npx shadcn@latest add`. Search first, build second.
- Never edit files in `src/components/ui/` — shadcn primitives managed by the CLI. Override via `className`, wrapper components, or `globals.css`.
- Prefer many small, focused components over one large file. A component does one thing.
- If the same JSX shape appears in two or more places, extract a component.
- Keep component APIs minimal — only props that are actually needed.

### Tailwind / CSS

- If the same Tailwind class string appears more than ~2 times, extract it — in order of preference:
  1. A small component that owns the styling (preferred when it has semantic meaning).
  2. A `cva`/`tv` variant or utility constant in `src/lib/`.
  3. A `@layer components` rule in `globals.css` only when 1 and 2 don't fit.
- Never duplicate long class strings across JSX blocks.
- Co-locate variant logic with the component that owns it. Don't scatter `cn(...)` ternaries throughout the tree.

### General

- No over-engineering, no premature abstraction. Write the simplest code that correctly solves the problem.
- Use `loading.tsx` and `error.tsx` at appropriate route segments. Wrap deferred data in `<Suspense>`.
- No dead code, no commented-out blocks, no unexplained `TODO`s.

---

## 10. MEMORY.md

A shared memory file at the project root. **Read it before every task.**

### Reading

- Always read `MEMORY.md` before making any change.
- Treat its contents as hard constraints — decisions recorded there override assumptions.

### Writing

Append an entry after:

- Completing a feature
- Making an architectural or implementation decision
- Discovering a pattern, approach, or dependency to avoid

Also append when explicitly instructed to remember something.

Each entry is a single line:

```
- [MM-DD-YYYY] <category>: <concise description>
```

Categories: `decision`, `completed`, `never`.

### Rules

- **Append-only.** Never modify or delete existing entries.
- **Only the user can delete entries** — and only when explicitly asked. Remove exactly what's pointed to, nothing else.
- Never add conflicting entries. If a previous decision is being superseded, flag it to the user and ask them to explicitly delete the old one first.
- No paragraphs, no long explanations. One line per entry.

---

## Checklist

- [ ] Read `MEMORY.md` before starting?
- [ ] Checked `node_modules/next/dist/docs/` and available skills before writing Next.js code?
- [ ] Server Component unless a hook / event handler / browser API forced otherwise?
- [ ] `"use client"` on the smallest possible leaf?
- [ ] Every read cached with `"use cache"` + `cacheLife({ stale: 60, revalidate: 3600, expire: 86400 })` + `cacheTag`?
- [ ] Every CRUD action invalidates matching tags via `updateTag` / `revalidateTag`?
- [ ] All server actions in `src/lib/actions/*` with `"use server";` at top?
- [ ] Read-only data fetchers in `src/lib/queries/` (or `src/lib/` if not yet migrated)?
- [ ] No `any`, no untyped params, no unsafe `as` casts?
- [ ] Checked `src/components/` and shadcn CLI before creating a new component?
- [ ] No edits to `src/components/ui/`?
- [ ] Repeated Tailwind class strings extracted into a component or utility?
- [ ] `loading.tsx` / `error.tsx` / `<Suspense>` in place where needed?
