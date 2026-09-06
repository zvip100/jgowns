# Project Rules

Read this file and `MEMORY.md` before every change.

## Project Context

**App:** JGowns, a wedding gown marketplace.

**Core flow:** seller registers and signs in, lists a gown (size, category, location, price, photos, contact info), pays a one-time publishing fee via Stripe-hosted Checkout, the listing goes live on confirmed payment, and buyers browse and contact the seller directly.

**No buyer-to-seller transactions in app.** Money never moves between buyer and seller here. Stripe **is implemented**, scoped to the seller publishing fee only: `listings.status` goes `pending_payment` to `active` on confirmed payment.

**Stack:**

- **Framework:** Next.js App Router (latest)
- **Auth / DB / Storage:** Supabase, via the official TypeScript client (`@supabase/supabase-js`, `@supabase/ssr`) for all auth, database queries, and file storage. No ORM.
- **Image pipeline (server-side):** Google Vision API face detection, then Sharp (blur faces, crop, convert to WebP, optimize). All image processing runs on the server.
- **Styling:** Tailwind CSS v4 syntax and conventions strictly. No v3 patterns.
- **Components:** shadcn/ui. **Icons:** `lucide-react`.
- **Payments:** Stripe, live, scoped to the listing publishing fee: hosted Checkout redirect (never embedded payment UI), signature-verified webhook plus a Checkout-success route handler that both confirm, `listing_payments` table, service-role-only `record_listing_payment` RPC, and a 30-day cleanup sweep of unpaid listings. Fee amount and kill switch live in env (`LISTING_FEE_CENTS`, `PAYMENTS_SUSPENDED`). Truth always comes from re-fetching the Checkout Session from Stripe's API, never from a webhook payload or URL param alone. Do not widen Stripe's scope (buyer payments, payouts, Connect, refunds) until asked.
- **Specs:** `docs/stripe-listing-fee-spec.md` (locked architecture), `docs/stripe-production-go-live.md` (go-live steps).

**Developer:** full-stack. Briefly explain reasoning when introducing a non-obvious approach or pattern.

## Agent Behavior

- **Do only what's asked.** No extra changes, no unsolicited refactors or suggestions. Exception: if a fix obviously applies to a sibling file (`LoginForm` / `RegisterForm`), flag it and offer, but do not apply until approved.
- **Flag duplication proactively.** The moment you copy a non-trivial block, long class string, or piece of logic into a second place, or make the same edit to a sibling file a second time, stop and either extract it or note it for extraction in your summary. Surface it early; defer the extraction itself until the shared shape has stabilized.
- **Clarify before acting** on anything ambiguous or underspecified.
- **Confirm before destructive changes** (deleting files, removing logic, breaking APIs).
- **When multiple valid approaches exist**, list them and wait for approval before writing code. Survey the real option space, do not cap at two, and do not lead with the heaviest. Include the lighter alternatives with each trade-off even when you have a recommendation.
- **Multiple visual options go in one artifact**, side by side in the app's real palette and context with each trade-off. A prose list or an injected page mock is not a substitute. Wait for the pick before coding.
- **Always the simplest, cleanest, best-practice solution.** No over-engineering.
- **Responses mirror the task.** Simple question, short answer. Complex task, full but concise. No filler phrases. Prefer bullet points over long paragraphs when the content can be listed. 
- **No over-commenting.** One short JSDoc-style comment above a complex function is fine; a multi-paragraph JSDoc is itself over-commenting. Never comment above random lines, never paragraph-style comments in code. Trim excessive comments in files you modify.
- **Code review / suggestion evaluation:** compile all findings into a single list before editing any file. Wait for explicit "apply all" or selective approval. Never auto-apply a finding the moment it is identified. A batch of pasted findings is evaluate-only by default even when it carries fix-language; "evaluate only" means do not apply the change, but still propose the fix.
- **Delegated background work gets a stated time budget before it starts**, is polled for progress rather than status, and is cancelled and done inline once the budget expires. "Running" is not progress: two consecutive polls showing the same repeated command with no new output means cancel, not keep waiting. Never close a response with a pending job as its final state; if work is still outstanding, say what will be done about it and by when.
- **Search exhaustiveness:** when asked to update "all" occurrences of something, search the full codebase before reporting done. Do not stop at the first match.
- **A stated preference is a codebase-wide instruction.** A design, UX, or behavior preference ("I don't like red borders", "always X", "never Y") applies to every instance across the codebase, not just the file shown. It does not license unrelated changes.
- **User-facing copy** (labels, hints, banners, empty states) is concise, professional, modern e-commerce English for a US audience: direct address, a short bold lead plus at most one supporting sentence, no parenthetical qualifiers or hedging. "Sell as a complete set only", not "Sell only as a complete set (not individually)".
- **Never gendered copy.** Refer to people as sellers, buyers, or your community. Product taxonomy like the "Women" category stays as is.
- **No em dashes in user-facing copy, ever.** Not in labels, hints, banners, empty states, page and body copy, legal documents (Terms/Privacy), email templates, or metadata `title`/`description`. Rewrite with a period, comma, colon, or parentheses. Hyphens in compound words and en dashes in numeric ranges are fine; the ban is specifically the em dash.
- **Never run `git commit` or `git push`.** The developer commits personally. When asked "to commit", prepare the tree (stage files, split hunks if needed) and suggest message(s) in the `/commit-msg` format, then stop. Never add a `Co-Authored-By` trailer or any other automated trailer to anything in this repo.
- **Metadata descriptions:** never write "on JGowns" in a `description` field; the site name already appears in the title template.
- **`noindex` requires explicit justification.** Auth utility pages (login, forgot-password, reset-password) are noindex by default. Registration, new-listing, and other discovery pages are indexed; do not noindex them without instruction. When unsure, ask.

## 1. Server-First

Everything that can run on the server must. A component is a Server Component unless it physically cannot be.

Add `"use client"` only if the file actually uses React hooks (`useState`, `useEffect`, `useRef`, `useReducer`, `useContext`, or a custom hook wrapping any of these), DOM event handlers (`onClick`, `onChange`, `onSubmit`), browser-only APIs (`window`, `document`, `localStorage`), or a third-party library that requires the client. Push it as far down the tree as possible: extract only the interactive leaf, never make a whole page a Client Component for one input.

Fetch data in Server Components, `page.tsx`, `layout.tsx`, or route handlers. Never in `useEffect` if a server fetch would work.

## 2. Caching

Use `next/cache`. No hand-rolled in-memory caches.

**Reads:** `"use cache"` + `cacheLife` + `cacheTag`, all imported from `next/cache`.

```ts
// src/lib/queries/listings.ts
export async function getListingById(id: string) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  cacheTag("listings", `listing:${id}`);
  const supabase = await createClient();
  // ...
}
```

- **Public data** (listings, filters, pagination): always cached, with the default policy `cacheLife({ stale: 60, revalidate: 3600, expire: 86400 })`.
- **User-specific data:** never cached. Fetch fresh on every request.
- Always tag reads: a collection tag (`"listings"`) plus a per-entity tag (`` `listing:${id}` ``).
- Never cache a function that reads `cookies()`, `headers()`, or `searchParams`. Pass those in as arguments instead.

**Writes:** after the mutation, invalidate every tag whose cached read the write affects, not just one (a listing edit invalidates both `` `listing:${id}` `` and `"listings"`). Tag names are a contract between reads and writes; keep them consistent.

A write with no cached read behind it invalidates nothing, and that is correct, not an omission: `submitContactMessage` writes to the write-only `contact_messages` table and the wishlist actions write user-specific rows that are never cached, so neither has a tag to invalidate.

- `updateTag(tag)` for immediate invalidation. **Prefer this** in server actions.
- `revalidateTag(tag, "max")` when a brief stale delay is acceptable.
- `revalidatePath` as a last resort only, when tags are unknown.

## 3. Server Actions

All server actions live in `src/lib/actions/`, grouped by domain, one file per domain: `auth.ts` (sign in / up / out, password reset), `listings.ts` (query, filter, search, paginate), `sell.ts` (create / edit / delete listing), `profile.ts` (profile and settings). Group by domain, not by individual function: `listings-search.ts` is wrong, `listings.ts` is right.

- Every action file starts with `"use server";` on line 1. No exceptions.
- Validate all input (e.g. with zod) before touching the DB or any external service.
- **Server actions are independently callable endpoints.** Enforce ownership and domain-state preconditions inside the action or database RPC. Never rely on a hidden button or intended UI flow to make an invalid call unreachable.
- **Validation rejects, it does not silently coerce.** Reject invalid input with a clear error rather than stripping or transforming it into something valid (do not `replace(/\D/g,"")` a phone so letters just vanish). Validate the raw value, then normalize. Silent coercion hides mistakes and lets garbage through.
- Invalidate tags and `redirect()` from inside the action after a successful mutation. §2 governs which invalidation call.
- **Atomic multi-writes use a Postgres RPC.** supabase-js talks to stateless PostgREST and cannot hold a transaction across `.from()` calls. Any mutation that writes multiple rows or tables and must be all-or-nothing (a parent row plus its children, a status cascade) goes in an RPC. Never sequence the writes client-side and hope they all land.
  - Write it as a `security invoker` plpgsql function with `set search_path = ''` and `grant execute ... to authenticated`, called via `supabase.rpc(...)`.
  - The function lives in a new migration **and** is folded into `schema.sql` (§9). Changing its logic means a new `create or replace` migration plus a `schema.sql` edit.
  - Storage side effects (image upload/delete) cannot join the DB transaction. Keep them in the action as compensating steps that run **after** the RPC commits.
- Export only server actions and their types/schemas. No UI, no client utilities.

**Read-only data fetchers** (server-side only, never called from the client) live in `src/lib/queries/`, grouped by domain.

**Shared validation schemas** live in `src/lib/validations/`, one kebab-case file per domain (`contact-schema.ts`, `listing-schema.ts`). A zod schema is the single source of truth shared by the server action (the authority) and the client form (inline field validation via `safeParse`). Never duplicate the rules or messages in both places.

## 4. TypeScript

- No `any`. Use `unknown` and narrow, or define a proper type.
- All function parameters and return types explicitly typed.
- Prefer `type` over `interface` unless declaration merging is needed.
- No `as` casts unless unavoidable; add a comment explaining why if used.
- Use `satisfies` to validate object shapes without widening the type.
- Component prop types are a named `type` above the function, named after the component with a `Props` suffix, never bare `Props`: `type ListingCardProps = { id: string; isActive: boolean }`.
- Global, reusable types (shared across multiple files) go in `src/lib/types.ts`. Component- or function-specific types live in the file that owns them.

## 5. Naming Conventions

- Components and component files: PascalCase (`ListingCard`, `FilterInput`, `ListingCard.tsx`).
- Util / action files: kebab-case (`listings.ts`, `sell.ts`).
- Variables and functions: camelCase (`getListings`, `listingId`).
- Types and interfaces: PascalCase (`ListingFilters`, `UserProfile`).
- Constants: SCREAMING_SNAKE_CASE (`MAX_UPLOAD_SIZE`).
- Boolean vars and props: `is` / `has` prefix (`isLoading`, `hasError`).
- A file holding one component is PascalCase. A module bundling several small related leaf components is a kebab-case barrel exporting them as named exports (`auth-form.tsx`, `filter-controls.tsx`).
- Never abbreviate identifiers: `UUID_REGEX` not `UUID_RE`, `MAX_FILE_SIZE` not `MAX_SZ`.

## 6. Import Order

Groups, each separated by a blank line: 1. Node built-ins. 2. External packages (React, Next.js, third-party). 3. Internal aliases (`@/lib/...`, `@/components/...`). 4. Relative imports (`./`, `../`). 5. Type-only imports (`import type ...`).

All imports appear at the top of the file. No code, declarations, or exports between import groups or before the import block is complete.

## 7. Error Handling

- **Server actions:** return a typed result object (`{ success, error }`). Never throw to the client.
- **Server Components:** `error.tsx` boundaries for unexpected errors; handle expected errors (not found, unauthorized) in the component.
- **Route handlers:** always return typed JSON with an appropriate HTTP status code.
- Never swallow errors silently (`catch (e) {}`). Log server-side, return a sanitized message to the client.
- **Client calls to redirecting server actions:** a server action that `redirect()`s on success throws `NEXT_REDIRECT`. Any client code wrapping such a call in `try/catch` must call `unstable_rethrow(e)` at the top of the `catch`, before showing an error, so the redirect or `notFound` signal is not swallowed and rendered as a form error.
- **Field validation stays inline; toasts are for outcomes.** Field-level validation renders inline, below the field. Transient feedback uses the toast helper (`src/lib/toast.ts`), which fires only on submit/action outcomes (success, or a server or network failure) and background events, never duplicating an inline field error. Do not hand-roll a bespoke inline or timeout notice for something the toast helper covers. Auth pages are the deliberate exception: persistent inline banners, no toasts.
- **An invalid form control shows only its error message, no red chrome.** Suppress shadcn's destructive border, ring, and text on invalid controls at the shared `src/components/form/` wrapper layer. Keep `aria-invalid` for accessibility, and re-assert the focus ring so a focused invalid control still has a visible, non-red indicator.

## 8. Next.js Version & Skills

This project runs the **latest Next.js**. Do not rely on training data for Next.js APIs, conventions, or behavior; it may be outdated. Before writing any Next.js code: check `node_modules/next/dist/docs/` for the current API and conventions, use the `next-best-practices` skill (Vercel), always load all available skills relevant to the task, and heed any deprecation notices found in those sources.

## 9. Code Quality

### Components & reuse

- Before building a new component, check `src/components/` for an existing one and check whether `npx shadcn@latest add` provides it. Search first, build second.
- Never edit files in `src/components/ui/`; they are shadcn primitives managed by the CLI. Override via `className`, wrapper components, or `globals.css`.
- Prefer many small, focused components over one large file. A component does one thing.
- The same JSX shape in two or more places gets extracted into a component.
- Keep component APIs minimal, only props that are actually needed.
- Use `lucide-react` icons as UI visual elements, including error pages, not-found pages, and empty states. Never emojis as visual replacements for icons.
- Before writing any new UI style (button, link, banner, hint, notice, anything else), check what already exists in the app and reuse it. Only introduce a new style when nothing existing fits. This applies to color values too: pull fills, borders, and hover/active states from the established theme tokens and palette (`--accent`, `--accent-deep`, `--gold-gradient`, the existing cream/gold hexes). Never invent a new hex for an interactive state; an off-palette color reads as out of place.
- **Colocate route-specific components and hooks in their route segment, not the global folders.** A component or hook used only within one route segment lives in that segment (e.g. `src/app/(main)/browse/`, mirroring `src/app/(auth)/`) and is imported relatively. `src/components/` and `src/hooks/` are for genuinely shared, cross-route pieces only. When a component's last out-of-segment consumer disappears, relocate it into the owning segment.
- **Group a shared multi-file feature into its own subfolder under `src/components/`.** When several genuinely shared components or providers belong to one feature (the wishlist provider, sheet, server-sync, trigger), colocate them in `src/components/<feature>/` (e.g. `src/components/wishlist/`) rather than scattering them flat. Route-segment-only pieces still colocate in their segment.

### Tailwind / CSS

- The same Tailwind class string appearing more than ~2 times gets extracted, in order of preference: (1) a small component that owns the styling, preferred when it has semantic meaning; (2) a `cva`/`tv` variant or utility constant in `src/lib/`; (3) a `@layer components` rule in `globals.css`, only when 1 and 2 do not fit.
- **Shared class constants go in the existing `src/lib/styles.ts`**, never a new per-feature or per-segment styles file. Colocation governs components and hooks, not style constants.
- Never duplicate long class strings across JSX blocks.
- Co-locate variant logic with the component that owns it. Do not scatter `cn(...)` ternaries throughout the tree.
- Buttons get `cursor-pointer` from a base rule in `globals.css` (`button:not(:disabled)`, `[role="button"]`), because Tailwind v4 preflight resets buttons to `cursor: default` and shadcn's `Button` does not restore it. Do not add it per element. Non-button dropzones and divs (react-dropzone roots, which get `role="presentation"`) still need it explicitly.
- Reusable, variant-capable gradients go in an `@utility` block. The IDE suggests `bg-(image:--var)` for this; it breaks under Turbopack dev, so do not use it.

### General

- The simplest code that correctly solves the problem. No over-engineering, no premature abstraction.
- Use `loading.tsx` and `error.tsx` at appropriate route segments. Wrap deferred data in `<Suspense>`.
- **Dynamic reads need an enclosing Suspense boundary (Cache Components).** Reading `searchParams`, `cookies()`, or `headers()` makes a component dynamic, and under Cache Components it must render inside a `<Suspense>` boundary so a static shell can stream, or the build fails with _"Uncached data was accessed outside of `<Suspense>`."_ A route `loading.tsx` **counts as that boundary**, so a page in a segment that has one (`(main)/` for `browse`) can `await searchParams` right at the top. A segment with **no** `loading.tsx` and no ancestor boundary (`(auth)/`) must add an explicit `<Suspense>`; since a component cannot sit inside a boundary it renders itself, put the `await` in a small async child of that boundary.
- No dead code, no commented-out blocks, no unexplained `TODO`s.
- Prefer an early return on guard and error paths over an `else` block.
- **No micro-modules.** When a file is left holding a single export, fold it into the sibling module that owns that role and delete the file.
- Test suites must cover every exported function from the module on the first pass. Confirm every export is tested before reporting done.
- Before flagging a legacy-data issue (stale enum values, old column formats), check migration history in `src/supabase/migrations/`. If a migration already resolved it, the finding is not actionable.
- Every migration added to `src/supabase/migrations/` must also be folded into `src/supabase/schema.sql`, the maintained fresh-install snapshot of the current schema, not a historical artifact. A migration without the matching `schema.sql` edit is incomplete.
- Supabase smoke tests (`smoke-NNN-*.sql`) live in `src/supabase/tests/`, never in `src/supabase/` directly.
- All auth and contact form inputs must carry the correct `autocomplete` attribute: `email`, `new-password`, `current-password`, `tel`, etc.
- Supabase auth email templates (confirm signup, reset password, etc.) are versioned in `docs/email-templates/*.html`, one file per template, sharing the same branded shell (inline-styled table layout, cream/gold palette, `{{ .ConfirmationURL }}` as both button and plain fallback link). Edit the file first, then paste into the dashboard; the dashboard copy is a deployment, not the source.
- **Verify with a real render before reporting done, visual or behavioral.** Use the `browser-verify` skill. Its quick-start routes you to the right weight, from a single screenshot to a full auth-crossing, data-mutating flow.
  - Always headless. Never `--headed`, never launch a visible browser.
  - The Playwright MCP server is retired. Do not use `mcp__playwright__*` tools.
  - Reuse the running dev server instead of starting a second one, and leave it running when you finish.
  - Responsive work checks at least one desktop and one narrow width.
  - Exercise the awkward states (long scrolled list, empty state, signed-out variant), not just the happy path.
  - A style override competing with an existing rule (shadcn default, theme token, specificity) needs its computed styles read back. A screenshot glance is not proof.
  - Save screenshots to `.playwright/<name>.png` (gitignored). A bare filename lands in the repo root.
- **Make requested visual changes clearly perceptible in one step.** When asked to increase spacing, size, or emphasis, a marginal bump (roughly 16px or less, or a single Tailwind step) reads as "nothing changed" and wastes a round trip. If the target amount is unspecified, err on the larger side and invite them to dial it back.
- **Check contrast before proposing a new color-on-color element.** Small text on a fill needs 4.5:1 (WCAG AA); it often decides between candidates that look equally good.

## 10. MEMORY.md

A shared memory file at the project root. Read it before every task; its contents are hard constraints and override assumptions.

Record after completing a feature, making an architectural decision, or discovering something to avoid, and when explicitly told to remember something. Spec and proposal docs do not earn an entry; only implemented work and decisions actually made do. Check **Uncommitted = draft** below before appending.

Format, one line per entry: `- [MM-DD-YYYY] <category>: <concise description>`

Categories route to sections: `decision` to `## Decisions`, `completed` to `## Completed`, `never` to `## Never`. **Every entry goes at the bottom of its own category section, never at the bottom of the file** (the file ends with `## Never`, so blind appending misfiles it). Find the section header first, then append after that section's last entry, immediately above the next `##`. Within a section, entries stay in the order they were added, oldest first.

- **Committed = frozen.** Never edit or delete a committed entry. Only the user deletes, only when explicitly asked, and only exactly what they point to.
- **Uncommitted = draft.** The unit of work is the uncommitted hunk, not the chat session. `git diff MEMORY.md` before writing. Same category plus same matter means rewrite that line to its final state (include a short why-this-not-the-first-version only if the choice is still load-bearing). Never add a second line saying it changed or fixed the earlier one.
- Never add conflicting entries. If a **committed** decision is superseded, flag it and wait for the user to delete the old one first.
- One entry is one line, with no internal line breaks or blank lines. Routine entries stay concise. A significant architectural decision earns a longer, information-dense single line: chosen approach, key rationale, why the main alternatives were rejected.

## Checklist

- [ ] `MEMORY.md` read, and updated in its matching category section? (§10)
- [ ] Next docs and relevant skills checked before writing Next.js code? (§8)
- [ ] Server Component by default, `"use client"` on the smallest leaf? (§1)
- [ ] Every read cached and tagged, every mutation invalidating each affected tag? (§2)
- [ ] Server actions in `src/lib/actions/*`, read-only fetchers in `src/lib/queries/`? (§3)
- [ ] Ownership and state preconditions enforced server-side, input rejected rather than coerced? (§3)
- [ ] Multi-row mutation atomic via RPC, with the matching `schema.sql` edit? (§3, §9)
- [ ] No `any`, no untyped params, no unsafe `as` casts? (§4)
- [ ] Existing component and shadcn checked first, nothing edited in `src/components/ui/`? (§9)
- [ ] Repeated class strings extracted, shared constants in `src/lib/styles.ts`? (§9)
- [ ] `loading.tsx` / `error.tsx` / `<Suspense>` where needed? (§9)
- [ ] Verified with a real render? (§9)
- [ ] No em dashes in user-facing copy? (Agent Behavior)
- [ ] No `git commit` or `git push` run? (Agent Behavior)
