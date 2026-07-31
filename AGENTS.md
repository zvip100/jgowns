# Project Rules

Read this file before every change.

---

## Project Context

**App:** JGowns — a wedding gown marketplace.

**Core flow:**

1. Seller creates an account and signs in.
2. Seller lists a gown with: size, category, location, price, photos, and contact info.
3. Seller pays a one-time publishing fee via Stripe-hosted Checkout; the listing goes live once payment is confirmed.
4. Buyer browses listings and contacts the seller directly.

**No buyer-to-seller transactions in app** — buyers contact sellers directly and money never moves between them here. Stripe **is implemented**, scoped to the seller publishing fee only (step 3): `listings.status` goes `pending_payment` → `active` on confirmed payment. Locked architecture in `docs/stripe-listing-fee-spec.md`.

**Stack:**

- **Framework:** Next.js App Router (latest)
- **Auth / DB / Storage:** Supabase — use the official Supabase TypeScript client (`@supabase/supabase-js`, `@supabase/ssr`) for all auth, database queries, and file storage. No ORM.
- **Image pipeline (server-side):** Google Vision API (face detection) → Sharp (blur faces, crop, convert to WebP, optimize). All image processing runs on the server.
- **Styling:** Tailwind CSS v4 — strictly follow v4 syntax and conventions. Do not use v3 patterns.
- **Component library:** shadcn/ui
- **Icons:** `lucide-react`
- **Payments:** Stripe — **live**, scoped to the listing publishing fee: hosted Checkout redirect (never embedded payment UI), signature-verified webhook + a Checkout-success route handler that both confirm, `listing_payments` table, service-role-only `record_listing_payment` RPC, and a 30-day cleanup sweep of unpaid listings. Fee amount and a kill switch live in env (`LISTING_FEE_CENTS`, `PAYMENTS_SUSPENDED`). Truth always comes from re-fetching the Checkout Session from Stripe's API, never from a webhook payload or URL param alone. Spec: `docs/stripe-listing-fee-spec.md`; go-live steps: `docs/stripe-production-go-live.md`. Do not widen Stripe's scope (buyer payments, payouts, Connect, refunds) until asked.

**Developer:** Junior full-stack developer. Briefly explain reasoning when introducing a non-obvious approach or pattern.

---

## Agent Behavior

- **Do only what's asked.** No extra changes, no unsolicited refactors, no unrequested suggestions. Exception: if a fix obviously applies to a sibling file (e.g. `LoginForm` ↔ `RegisterForm`), flag it and offer — but do not apply until approved.
- **Flag duplication proactively.** The moment you copy a non-trivial block, long class string, or piece of logic into a _second_ place — or make the same edit to a sibling file a second time — stop and either extract it or note it for extraction in your summary. Don't let duplication pile up silently across edits. Still defer the extraction itself until the shared shape has stabilized (no premature abstraction); surface it early, don't necessarily abstract it early.
- **Clarify before acting** on anything ambiguous or underspecified.
- **Confirm before destructive changes** (deleting files, removing logic, breaking APIs).
- **When multiple valid approaches exist**, list them briefly and wait for approval before writing code. Survey the real option space first — don't artificially cap at two, and don't lead with the heaviest solution. Include the lighter/simpler alternatives with each one's trade-off, even when you have a recommendation.
- **Multiple visual options go in one artifact**, rendered side by side in the app's real palette and context with each trade-off. A prose list or an injected page mock is not a substitute. Wait for the pick before coding.
- **Always choose the simplest, cleanest, best-practice solution.** Don't over-engineer.
- **Responses mirror the task.** Simple question → short answer. Complex task → full but concise. No filler phrases.
- **No over-commenting.** A single JSDoc-style comment above a complex function is fine, but keep it to a few lines. A multi-paragraph JSDoc is itself over-commenting. Never comment above random lines, never write paragraph-style comments in code. If a file being modified has excessive comments, remove or trim them as part of the task.
- **Code review / suggestion evaluation:** Compile all findings into a single list before editing any file. Wait for explicit "apply all" or selective approval. Never auto-apply a finding the moment it is identified.
- **Search exhaustiveness:** When asked to update "all" occurrences of something, search the full codebase before reporting done. Do not stop at the first match.
- **A stated preference is a codebase-wide instruction.** When the user expresses a design/UX/behavior preference ("I don't like red borders", "always X", "never Y"), apply it to every instance across the codebase — not just the file currently open — even if they showed it in one spot. This is the aesthetic/behavioral counterpart to Search exhaustiveness; it scopes the stated preference fully and does not license unrelated changes.
- **User-facing copy** (labels, hints, banners, empty states) is concise, professional, modern e-commerce English for a US audience: direct address, a short bold lead plus at most one supporting sentence, no parenthetical qualifiers or hedging. Example: "Sell as a complete set only" — not "Sell only as a complete set (not individually)".
- **No em dashes in user-facing copy — ever.** Never use the em dash (—) anywhere on the site: labels, hints, banners, empty states, page and body copy, legal documents (Terms/Privacy), email templates, and metadata `title`/`description`. Rewrite with a period, comma, colon, or parentheses instead. Hyphens in compound words and en dashes in numeric ranges are fine; the ban is specifically the em dash.
- **Never run `git commit` or `git push`.** The developer commits personally. When asked "to commit," prepare the tree (stage files, split hunks if needed) and suggest message(s) in the `/commit-msg` format — then stop. Never add a `Co-Authored-By` trailer or any other automated trailer to anything in this repo.
- **Metadata descriptions:** Never write "on JGowns" in metadata `description` fields — the site name already appears in the title template.
- **`noindex`** applied to a page requires explicit justification. Auth utility pages (login, forgot-password, reset-password) are noindex by default; registration, new-listing, and other discovery pages are indexed — do not noindex them without instruction. When unsure, ask.

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
- **Server actions are independently callable endpoints.** Enforce ownership and domain-state preconditions inside the action or database RPC; never rely on a hidden button or intended UI flow to make an invalid call unreachable.
- **Validation rejects, it doesn't silently coerce.** Reject invalid input with a clear error rather than stripping/transforming it into something valid (e.g. don't `replace(/\D/g,"")` a phone so letters just vanish — validate the raw value, _then_ normalize). Silent coercion hides mistakes from the user and lets garbage through.
- Call `revalidateTag` / `redirect` from inside the action after a successful mutation.
- **Atomic multi-writes use a Postgres RPC.** supabase-js talks to stateless PostgREST and can't hold a transaction across `.from()` calls, so any mutation that writes multiple rows/tables and must be all-or-nothing (a parent row + its children, a status cascade) goes in a `security invoker` plpgsql function with `set search_path = ''` and `grant execute … to authenticated`, called via `supabase.rpc(...)` — never sequence the writes client-side and hope they all land. The function lives in a new migration **and** is folded into `schema.sql` (§9); changing its logic means a new `create or replace` migration + a `schema.sql` edit. Storage side effects (image upload/delete) can't join the DB transaction — keep them in the action as compensating steps that run **after** the RPC commits.
- Export only server actions and their types/schemas. No UI, no client utilities.

**Read-only data fetchers** (server-side only, never called from the client) live in `src/lib/queries/`, grouped by domain. Currently `src/lib/` may have flat query files — as the project grows, move them into this folder.

**Shared validation schemas** live in `src/lib/validations/`, one kebab-case file per domain (`contact-schema.ts`, `listing-schema.ts`). A zod schema is the single source of truth shared by the server action (the authority) and the client form (inline field validation via `safeParse`) — never duplicate the rules or messages in both places.

---

## 4. TypeScript

- No `any`. Use `unknown` and narrow, or define a proper type.
- All function parameters and return types are explicitly typed.
- Prefer `type` over `interface` unless declaration merging is needed.
- No `as` casts unless unavoidable — add a comment explaining why if used.
- Use `satisfies` to validate object shapes without widening the type.
- Declare component prop types as a named `type` above the function. Name it after the component with a `Props` suffix — never just `Props`:
  ```ts
  type ListingCardProps = { id: string; isActive: boolean };
  export function ListingCard({ id, isActive }: ListingCardProps) { ... }
  ```
- Global, reusable types (shared across multiple files) belong in `src/lib/types.ts`. Component- or function-specific types live in the same file as the component or function that owns them.

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

A file holding one component is PascalCase (`ListingCard.tsx`). A module that bundles several small related leaf components is a kebab-case barrel exporting them as named exports (`auth-form.tsx`, `filter-controls.tsx`).

Never abbreviate identifiers: `UUID_REGEX` not `UUID_RE`, `MAX_FILE_SIZE` not `MAX_SZ`.

---

## 6. Import Order

Separate each group with a blank line:

1. Node built-ins
2. External packages (React, Next.js, third-party)
3. Internal aliases (`@/lib/...`, `@/components/...`)
4. Relative imports (`./`, `../`)
5. Type-only imports (`import type ...`)

Imports must appear at the top of the file. No code, declarations, or exports go between import groups or before the import block is complete.

---

## 7. Error Handling

- **Server actions:** return a typed result object (`{ success, error }`) — never throw to the client.
- **Server Components:** use `error.tsx` boundaries for unexpected errors; handle expected errors (not found, unauthorized) in the component.
- **Route handlers:** always return typed JSON with an appropriate HTTP status code.
- Never swallow errors silently (`catch (e) {}`).
- Log errors server-side; return a sanitized message to the client.
- **Client calls to redirecting server actions:** a server action that `redirect()`s on success throws `NEXT_REDIRECT`. Any client code that wraps such a call in `try/catch` must call `unstable_rethrow(e)` at the top of the `catch` (before showing an error) so the redirect/`notFound` signal isn't swallowed and rendered as a form error.
- **Field validation stays inline; toasts are for outcomes.** Field-level validation renders inline (message below the field); transient feedback uses the toast helper (`src/lib/toast.ts`), which fires only on submit/action OUTCOMES (success, or a server/network failure) and background events — never duplicating an inline field error. Don't hand-roll a bespoke inline/timeout notice for something the toast helper covers. Auth pages are the deliberate exception (persistent inline banners, no toasts).
- **An invalid form control shows only its error message, no red chrome.** Suppress shadcn's destructive border/ring/text on invalid controls at the shared `src/components/form/` wrapper layer; keep `aria-invalid` for accessibility and re-assert the focus ring so a focused invalid control still has a visible (non-red) indicator.

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
- Use `lucide-react` icons as UI visual elements — including error pages, not-found pages, and empty states. Never use emojis as visual replacements for icons.
- Before writing any new UI style — button, link, banner, hint, notice, or anything else — check what already exists in the app and reuse it if possible. Only introduce a new style when nothing existing fits. This applies to color values too: pull fills, borders, and hover/active states from the established theme tokens and palette (`--accent`, `--accent-deep`, `--gold-gradient`, the existing cream/gold hexes). Don't invent a new hex for an interactive state — an off-palette color reads as out of place.
- **Colocate route-specific components and hooks in their route segment, not the global folders.** A component or hook used only within one route segment lives in that segment (e.g. `src/app/(main)/browse/`, mirroring `src/app/(auth)/`) and is imported relatively. `src/components/` and `src/hooks/` are for genuinely shared / cross-route pieces only. When a component's last out-of-segment consumer disappears, relocate it into the owning segment.
- **Group a shared multi-file feature into its own subfolder under `src/components/`.** When several genuinely-shared components/providers belong to one feature (e.g. the wishlist provider, sheet, server-sync, trigger), colocate them in `src/components/<feature>/` (e.g. `src/components/wishlist/`) rather than scattering them flat in `src/components/`. Route-segment-only pieces still colocate in their segment.

### Tailwind / CSS

- If the same Tailwind class string appears more than ~2 times, extract it — in order of preference:
  1. A small component that owns the styling (preferred when it has semantic meaning).
  2. A `cva`/`tv` variant or utility constant in `src/lib/`.
  3. A `@layer components` rule in `globals.css` only when 1 and 2 don't fit.
- **Shared class constants go in the existing `src/lib/styles.ts`** — never a new per-feature or per-segment styles file. Colocation governs components and hooks, not style constants.
- Never duplicate long class strings across JSX blocks.
- Co-locate variant logic with the component that owns it. Don't scatter `cn(...)` ternaries throughout the tree.
- Buttons get `cursor-pointer` from a base rule in `globals.css` (`button:not(:disabled)`, `[role="button"]`) — Tailwind v4 preflight resets buttons to `cursor: default` and shadcn's `Button` doesn't restore it. Don't add `cursor-pointer` per-element. Non-button dropzones/divs (e.g. react-dropzone roots, which get `role="presentation"`) still need it explicitly.

### General

- No over-engineering, no premature abstraction. Write the simplest code that correctly solves the problem.
- Use `loading.tsx` and `error.tsx` at appropriate route segments. Wrap deferred data in `<Suspense>`.
- **Dynamic reads need an enclosing Suspense boundary (Cache Components).** Reading `searchParams`, `cookies()`, or `headers()` makes a component dynamic; under Cache Components it must render inside a `<Suspense>` boundary so a static shell can stream — otherwise the build fails with _"Uncached data was accessed outside of `<Suspense>`."_ A route `loading.tsx` **counts as that boundary**, so a page in a segment that has one (e.g. `(main)/` → `browse`) can `await searchParams` right at the top. A segment with **no** `loading.tsx` and no ancestor boundary (e.g. `(auth)/`) must add an explicit `<Suspense>`; since a component can't sit inside a `<Suspense>` it renders itself, put the `await` in a small async child of that boundary.
- No dead code, no commented-out blocks, no unexplained `TODO`s.
- Test suites must cover every exported function from the module on the first pass. Confirm every export is tested before reporting done.
- Before flagging a legacy-data issue (e.g. stale enum values, old column formats), check migration history in `src/supabase/migrations/`. If a migration already resolved it, the finding is not actionable.
- Every migration added to `src/supabase/migrations/` must also be folded into `src/supabase/schema.sql` — that file is the maintained fresh-install snapshot of the current schema, not a historical artifact. A migration without the matching schema.sql edit is incomplete.
- All auth and contact form inputs must carry the correct `autocomplete` attribute: `email`, `new-password`, `current-password`, `tel`, etc.
- Supabase auth email templates (confirm signup, reset password, etc.) are versioned in `docs/email-templates/*.html` — one file per template, sharing the same branded shell (inline-styled table layout, cream/gold palette, `{{ .ConfirmationURL }}` as both button and plain fallback link). Edit the file first, then paste into the dashboard; the dashboard copy is a deployment, not the source.
- **Verify layout/visual changes with a real render before reporting done.** Strongly prefer the `playwright` MCP server (drives Edge) — it is far more capable than a static screenshot (real interaction, device emulation, a logged-in profile for auth-gated pages, console access). Run the dev server on `localhost:3000`, then navigate, interact to reach the state under test (click, scroll), screenshot, and check console errors. Check at least one desktop and one narrow width for responsive work. Reaching the state and screenshotting it is not the same as confirming it is correct: judge the rendered result against what the user asked for, not against your own intended diff. If the screenshot shows something off (dead space, misalignment, overlap, an element that reads as broken), that is a failure even when the computed numbers match your plan, so fix it before reporting done. Exercise the awkward states where spacing/layout bugs surface, a list scrolled with many items, the empty state, and the signed-out variant, not just the happy path. Reuse an already-running dev server rather than starting a fresh one, and leave it running when you finish — don't kill or restart it between checks (the developer iterates repeatedly). A Playwright browser context that drops between turns is not the server dying; just re-navigate to reopen it. When the change is a color/style override that competes with an existing rule (a shadcn primitive default, a theme token, cascade/specificity), a screenshot glance is not proof it worked — confirm the override actually took effect by reading the element's computed styles (`browser_evaluate` + `getComputedStyle`), not just that the page rendered. If the playwright tools appear missing or disconnected, that is usually just a dropped connection, not a permanent absence — ask the developer to reconnect it (`/mcp` → reconnect) and retry; the agent cannot reconnect it itself. `Browser is already in use for …\ms-playwright-mcp\…` is different: a profile lock from an orphaned Edge that reconnecting won't clear — find the holder with `Get-CimInstance Win32_Process` filtered on `ms-playwright-mcp` and ask before killing it (never blanket-kill `msedge.exe`). Save screenshots to `.playwright-mcp/<name>.png`; a bare filename lands in the repo root. The headless fallback needs an absolute `--screenshot=` path plus its own `--user-data-dir`, and cannot click. Only after a reconnect genuinely fails, fall back to a static headless screenshot (no interaction): `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --window-size=1440,900 --screenshot=<out.png> <url>`.
- **Make requested visual changes clearly perceptible in one step.** When the user asks to increase spacing, size, or emphasis, a marginal bump (roughly ≤16px, or a single Tailwind step) often reads as "nothing changed" and wastes a round trip. If the target amount is unspecified, err on the larger side and invite them to dial it back.
- **Check contrast before proposing a new color-on-color element.** Small text on a fill needs 4.5:1 (WCAG AA); it often decides between candidates that look equally good.

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

**Every entry goes at the bottom of its own category section, never at the bottom of the file.** `MEMORY.md` is split into three sections, and the file ends with `## Never`, so appending blindly files the entry under the wrong category. Find the section header first, then append after that section's last entry.

| Category    | Section        |
| ----------- | -------------- |
| `decision`  | `## Decisions` |
| `completed` | `## Completed` |
| `never`     | `## Never`     |

Within a section, entries stay in the order they were added (oldest first), so a new one always goes immediately above the next `##` header.

### Rules

- **Append-only.** Never modify or delete existing entries — except to correct your own same-session entries (see **Same-session upkeep** below).
- **Only the user can delete entries** — and only when explicitly asked. Remove exactly what's pointed to, nothing else.
- **Same-session upkeep.** Before wrapping up, re-check the entries you appended _this session_. If later same-session work changed a path, name, or behavior one of them describes, correct that entry in place **without asking** — it's your own just-written note. This applies to same-session entries only; entries from earlier sessions still require explicit user authorization to modify or delete. "Session" means the continuous working conversation, not a calendar day — a date rollover mid-session does not turn this session's entries into earlier-session entries.
- Never add conflicting entries. If a previous decision is being superseded, flag it to the user and ask them to explicitly delete the old one first.
- One entry = one line (no internal line breaks or blank lines between parts of an entry). Keep routine entries concise. For a significant architectural decision, a longer, information-dense single line is expected and encouraged — capture the chosen approach, the key rationale, and why the main alternatives were rejected, so the decision is defensible later without re-deriving it.

---

## Checklist

- [ ] Read `MEMORY.md` before starting?
- [ ] New `MEMORY.md` entry appended to its **matching category section** (`decision` → `## Decisions`), not to the end of the file?
- [ ] Checked `node_modules/next/dist/docs/` and available skills before writing Next.js code?
- [ ] Server Component unless a hook / event handler / browser API forced otherwise?
- [ ] `"use client"` on the smallest possible leaf?
- [ ] Every read cached with `"use cache"` + `cacheLife({ stale: 60, revalidate: 3600, expire: 86400 })` + `cacheTag`?
- [ ] Every CRUD action invalidates matching tags via `updateTag` / `revalidateTag`?
- [ ] All server actions in `src/lib/actions/*` with `"use server";` at top?
- [ ] Read-only data fetchers in `src/lib/queries/`?
- [ ] No `any`, no untyped params, no unsafe `as` casts?
- [ ] Checked `src/components/` and shadcn CLI before creating a new component?
- [ ] No edits to `src/components/ui/`?
- [ ] Repeated Tailwind class strings extracted into a component or utility?
- [ ] `loading.tsx` / `error.tsx` / `<Suspense>` in place where needed?
- [ ] No em dashes (—) in any user-facing copy?
