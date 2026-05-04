<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Project rules — read before every change

This is a **Next.js App Router** project. The rules below are not suggestions, they are hard requirements. Re-read this file whenever you are about to create a component, write a server action, or add styles.

## 1. Server-first by default — client is the exception

Everything that **can** run on the server **must** run on the server. A React component is a Server Component unless it physically cannot be one.

### Default rule

- **Do not add `"use client"` unless the file genuinely needs it.**
- A new component starts as a Server Component. You only convert it (or extract a small leaf out of it) to a Client Component when there is no other way.

### The only valid reasons to mark a file `"use client"`

A file may be a Client Component **only** if it actually uses one of these:

- React hooks: `useState`, `useEffect`, `useRef`, `useReducer`, `useContext`, `useMemo`/`useCallback` that depend on client state, custom hooks that wrap any of the above.
- DOM event handlers passed as props on JSX (`onClick`, `onChange`, `onSubmit`, `onInput`, `onKeyDown`, etc.).
- Browser-only APIs (`window`, `document`, `localStorage`, `IntersectionObserver`, `matchMedia`, `navigator`, …).
- Third-party libraries that themselves require the client (e.g. components built on top of the above).

If none of those apply → it stays a Server Component. No exceptions for "convenience".

### Push the `"use client"` boundary as far down the tree as possible

When a page needs _some_ interactivity, do **not** turn the whole page into a client component. Instead:

1. Keep the page, layout, and surrounding sections as Server Components.
2. Extract **only the interactive bit** into the smallest possible Client Component (e.g. a single button, a single input, a single popover trigger).
3. Pass server-rendered content into that client leaf via `children` or props so the static parts stay on the server.

Bad: making a 400-line listings page a client component because one filter input needs `useState`.
Good: keeping the page on the server and extracting `<FilterInput />` as the client leaf.

### Data fetching

- Fetch data in Server Components / `page.tsx` / `layout.tsx` / route handlers.
- Do **not** fetch data in client components with `useEffect` if a server fetch would work.
- Pass already-fetched data down as props to client leaves when they need it.

### Cache everything you can — revalidate on writes

This project uses Next.js **Cache Components**. The goal is simple: **serve cached data by default, refresh it the moment something changes**. Users get fast pages, the database gets fewer queries, and the data is never stale after a mutation.

Use the APIs from `next/cache`. Don't reach for hand-rolled in-memory caches.

**Reads — wrap data fetchers in `"use cache"`**

Any function (or component) that reads data the user doesn't strictly need fresh-per-request should be cached. Put `"use cache"` at the top of the function body, set a lifetime with `cacheLife`, and tag it with `cacheTag` so you can invalidate it later.

```ts
// src/lib/data/listings.ts
import { cacheLife, cacheTag } from "next/cache";

export async function getListings(filters: ListingFilters) {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  return db.listings.findMany({ where: toWhere(filters) });
}

export async function getListingById(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("listings", `listing:${id}`);
  return db.listings.findUnique({ where: { id } });
}
```

Rules:

- Pick a sensible `cacheLife` profile (`seconds` / `minutes` / `hours` / `days` / `weeks` / `max`). Default to `hours` or `days` for content; only use `seconds` when you really mean it.
- **Always tag** cached reads with `cacheTag(...)` so writes can invalidate them precisely. Use a coarse tag for the collection (`"listings"`) and a fine tag per entity (`` `listing:${id}` ``) so a single update doesn't blow away everything.
- Do **not** put `"use cache"` on a function that reads `cookies()`, `headers()`, `searchParams`, or any other request-time API. Pass the runtime value in as an argument instead — it becomes part of the cache key automatically.
- Do **not** cache user-specific authenticated data unless the per-user key is explicit (e.g. passed as an argument).

**Writes — invalidate the matching tags inside the server action**

Every mutation (create / update / delete) must invalidate the cache tags it affects. Do it inside the server action, after the DB write succeeds.

- Prefer **`updateTag(tag)`** — it expires the cache immediately so the user sees their own write right away (read-your-own-writes). Server-action-only.
- Use **`revalidateTag(tag, "max")`** when a slight stale-while-revalidate delay is fine (background refresh, non-author viewers).
- Use **`revalidatePath(path)`** only as a last resort when you don't know the tags.

```ts
// src/lib/actions/sell.ts
"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

export async function createListing(formData: FormData) {
  const data = parseListing(formData);
  const listing = await db.listings.create({ data });

  updateTag("listings");
  redirect(`/listings/${listing.id}`);
}

export async function updateListing(id: string, formData: FormData) {
  const data = parseListing(formData);
  await db.listings.update({ where: { id }, data });

  updateTag(`listing:${id}`);
  updateTag("listings");
}
```

Rules:

- Every CRUD action invalidates **at least one** tag. If it doesn't, the cached reads will go stale.
- Invalidate the **narrowest** tag that covers the change, plus any list/collection tag the entity appears in (e.g. `` `listing:${id}` `` _and_ `"listings"`).
- Tag names are a contract between reads and writes — keep them consistent. If `getListings()` tags `"listings"`, the action that mutates a listing must invalidate `"listings"`.
- Do not call `revalidateTag` / `updateTag` from a Client Component or a `useEffect`. They belong in server actions and route handlers only.

**Quick mental model:** read = `"use cache"` + `cacheLife` + `cacheTag`. Write = mutate + `updateTag` (or `revalidateTag`). Anything that depends on the request itself = no cache, wrap in `<Suspense>`.

## 2. Server Actions live in `src/lib/actions/`, grouped by topic

All server actions go in `src/lib/actions/`. They are **not** colocated with components or pages, and they are **not** split into one file per action.

### How to group

Group actions by **topic / domain**, not by individual function. One file per concern:

- `listings.ts` — querying items, filters, search, pagination.
- `auth.ts` — sign in, sign up, sign out, password reset.
- `sell.ts` — listing a gown for sale, editing a listing, deleting a listing.
- `profile.ts` — updating profile, avatar, settings.
- …and so on.

If a new action clearly belongs to an existing topic, **add it to that file**. Only create a new file when the topic itself is new. Do not create `listings-search.ts`, `listings-filter.ts`, `listings-paginate.ts` — that's `listings.ts`.

### Hard rules

- **Every server-action file starts with `"use server";`** on line 1 of the file. No exceptions, no per-function `"use server"` inside a component file.
- One **topic** per file (not one action per file). Related actions stay together; unrelated actions never share a file.
- Action files export **only** server actions and the types/schemas they need. No UI, no components, no client utilities.
- Do **not** import server-action files into client components for anything other than calling the action. Never re-export from them into client modules.
- Validate input inside the action (e.g. with zod) before touching the database or external services. Never trust the caller.
- Call `revalidateTag` / `revalidatePath` / `redirect` from inside the action when the mutation should refresh server-rendered data.

### Folder shape

```text
src/
  lib/
    actions/
      listings.ts   ← querying, filtering, searching gowns
      auth.ts       ← sign in / up / out, password reset
      sell.ts       ← create / edit / delete a listing
      profile.ts    ← profile + settings updates
      ...
```

If a file does not start with `"use server";` it is **not** a server-actions file and must not contain server actions.

## 3. Clean, DRY solutions — no copy-paste

Long files and repeated code are bugs. Before you write something, check if it already exists; before you repeat something, extract it.

### Tailwind / CSS

- If the same Tailwind class string appears more than ~2 times, extract it. Options, in order of preference:
  1. A small **component** that owns the styling (e.g. `<SectionTitle />`, `<MutedText />`, `<CardShell />`) — preferred when the repetition also has semantic meaning.
  2. A **utility** constant or `cva`/`tv` variant (or a helper in `src/lib/`) when it is purely a class string used across unrelated places.
  3. A `@layer components` rule in the global stylesheet only when 1 and 2 don't fit.
- Never duplicate long Tailwind class strings across multiple JSX blocks. If you catch yourself pasting the same `flex items-center gap-2 rounded-lg border …` in three places, stop and extract.
- Co-locate variant logic with the component that owns it. Don't scatter `cn(...)` ternaries throughout the tree.

### JSX / components

- Prefer many small, reusable components over one large file that re-implements the same structure repeatedly.
- If you see the same JSX shape (same wrapper + same children pattern) in two or more places, extract a component.
- A component file should do **one** thing. If a file is getting long because it contains 4 unrelated subsections, split it.
- Reuse what already exists in `src/components/` and `src/components/ui/` before inventing a new variant. Search first, build second.
- Keep component APIs minimal: only the props that are actually needed. No "kitchen sink" props "just in case".

### General

- No dead code, no commented-out blocks left behind, no `TODO` without a reason.
- No unnecessary `"use client"`, no unnecessary `useEffect`, no unnecessary state.
- If a change makes a file noticeably longer without adding capability, you are probably repeating yourself — refactor instead.

---

## Quick checklist before you finish a change

- [ ] Did I keep this on the server unless a hook / event handler / browser API forced me off?
- [ ] If I added `"use client"`, is it on the **smallest possible** leaf?
- [ ] Did I cache every read I reasonably can with `"use cache"` + `cacheLife` + `cacheTag`?
- [ ] Does every CRUD action invalidate the matching tag(s) via `updateTag` / `revalidateTag`?
- [ ] Are all server actions in `src/lib/actions/*` with `"use server";` at the top of the file?
- [ ] Did I extract repeated Tailwind class strings into a component or utility?
- [ ] Did I extract repeated JSX shapes into a small reusable component?
- [ ] Did I check `src/components/` and `src/components/ui/` before building something new?
