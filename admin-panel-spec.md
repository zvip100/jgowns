# JGowns Admin Panel — Strategy Spec

**Status:** Strategy / product-engineering spec (no implementation)  
**Date:** 2026-07-10  
**Audience:** Product + engineering  
**Scope:** Full-fledged internal admin for marketplace operations, moderation, and observability

---

## 1. Current product snapshot

JGowns is a **seller-centric wedding gown marketplace**:

1. Seller registers / signs in (email+password or Google).
2. Seller lists a gown (1–3 photos, sizes/variants, category, location, price, contact).
3. Buyer browses public listings and contacts the seller via `mailto:` / `tel:` (out-of-band).

**There is no admin surface today.** No roles, no `profiles` table, no service-role client, no audit log, no view/contact analytics, no report/flag flow. Every authenticated user is a seller with the same capabilities.

### What exists that admin will build on

| Domain | Today |
|--------|--------|
| Listings | `active` / `sold` / `removed`; soft-remove only |
| Variants | `listing_sizes` with `available` / `sold`; sell modes `individual` / `set_only` / `either` |
| Images | Public `gown-images` bucket; Vision face-blur + Sharp WebP pipeline |
| Seller dashboard | Own listings + derived stats (counts, inventory value) |
| Auth | Supabase Auth; proxy guards `/dashboard/*` only |
| Payments | `payment_intents` table scaffolded; **Stripe not implemented** — admin payment UI stays future |
| Contact | Per-listing `contact_email` / `contact_phone`; no in-app messages |

### Hard constraints from project rules

- Server-first Next.js App Router; admin mutations = server actions in `src/lib/actions/`.
- Supabase client only (no ORM); multi-row writes via Postgres RPCs when atomicity matters.
- Public reads use `"use cache"` + tags; user/admin reads that depend on auth are **never** cached the same way.
- Do not scaffold Stripe until explicitly asked — admin may reserve a “Payments” section as a stub/placeholder only.
- Soft-remove (`status = 'removed'`) is the existing delist pattern; prefer extending it over inventing a parallel “hidden” flag unless moderation needs a distinct state.

---

## 2. Goals & non-goals

### Goals

Give a trusted operator **god-mode visibility and control** over the marketplace:

- See everything: users, listings (all statuses), variants, images, derived health metrics.
- Do everything safe and reversible first: edit any listing, force status changes, remove/restore, manage variants, purge storage when needed.
- Measure what’s going on: inventory, velocity, seller activity, content health — and later traffic/contact funnels once instrumentation exists.
- Leave an audit trail for every privileged action.
- Keep the public seller UX unchanged; admin is a separate privileged surface.

### Non-goals (v1)

- Buyer accounts, favorites, in-app messaging, or replacing `mailto`/`tel`.
- Implementing Stripe / charging listing fees (document hooks only).
- Public-facing “report this listing” UI (can be phase 2; admin can still act without reports).
- Multi-tenant org roles / fine-grained RBAC beyond `admin` vs everyone else (start with a single admin role).
- Replacing Supabase Auth dashboard for password resets / email templates (link out where useful).

---

## 3. Access control strategy

Admin cannot work on top of current RLS: public SELECT is `status = 'active'` only; sellers only see/mutate their own rows. Removed listings and cross-seller data are invisible to a normal session.

### Recommended approach (pick one before build)

**A — Profiles + JWT role claim + RLS admin policies (recommended)**

1. Add `public.profiles` (`id` → `auth.users`, `role` enum `'seller' | 'admin'`, timestamps, optional display fields, `is_banned`, etc.).
2. Sync profile on signup (trigger or auth action).
3. Mirror `role` into a custom JWT claim (Supabase Auth Hook / `app_metadata`) so RLS can read `auth.jwt() ->> 'role' = 'admin'`.
4. Add RLS policies: admins SELECT/UPDATE/DELETE on `listings`, `listing_sizes`, and later admin tables.
5. Admin route guard: `getUser()` (network-verified, same as dashboard proxy) **plus** role check — never `getClaims()` alone for security boundaries.

**Why A:** Keeps one data-access path (supabase-js + RLS), matches AGENTS “no ORM / RLS as ownership gate,” and avoids scattering service-role usage.

**B — Service-role client only inside admin server actions**

- Admin actions use `SUPABASE_SERVICE_ROLE_KEY` and bypass RLS.
- Simpler schema (no admin RLS policies), but every admin query must be carefully scoped; easier to accidentally over-expose if a bug leaks the client.

**C — Allowlist of admin user IDs / emails in env**

- Fastest MVP (`ADMIN_EMAILS=…`), no profiles table.
- Rejected as long-term: no ban state, no UI to promote admins, brittle ops.

**Recommendation:** **A** for production admin; optional short **C** spike only if you need a one-weekend internal tool before profiles land. Do not mix A and B casually — pick a primary access path.

### Route protection

- New route group `(admin)` under e.g. `/admin/*`.
- Extend `src/proxy.ts` matcher to include `/admin/:path*`.
- Unauthenticated → `/login?next=/admin/...`.
- Authenticated non-admin → dedicated **403 / not found** page (prefer opaque 404 for security-through-obscurity on existence of admin, or explicit 403 — decide once and stick to it).
- `robots.ts`: disallow `/admin/`.
- All admin pages: `noindex` (utility surface, not discovery).

### Admin client rules

- Never ship service-role or elevated keys to the browser.
- Admin UI may be Client Components for tables/filters, but **all mutations** go through `"use server"` actions that re-check role on every call (actions are independently callable).
- Prefer reusing existing Zod schemas from sell/listings where possible; admin schemas may allow fields sellers cannot set (e.g. force `status`, reassign `user_id` — only if product wants reassignment).

---

## 4. Information architecture

### Suggested route map

```
/admin                          → Overview dashboard (metrics)
/admin/listings                 → All listings table (filters, bulk actions)
/admin/listings/[id]            → Listing detail + edit + variant + image + audit
/admin/users                    → All users / sellers
/admin/users/[id]               → User detail + their listings + actions
/admin/moderation               → Queue: removed, flagged (later), pending (if added)
/admin/media                    → Storage / image health (orphans, broken refs)
/admin/analytics                → Deeper charts / time ranges (can merge into overview early)
/admin/audit                    → Immutable action log browser
/admin/ops                      → Cache revalidation, health checks, links to Supabase
/admin/payments                 → Placeholder until Stripe (hide or “Coming soon”)
```

### Layout / UX principles

- Separate chrome from the public cream/gold marketing site: dense, utilitarian, table-first (this *is* a dashboard — exception to marketing “no cards/dashboard” rules).
- Sticky filter bar + searchable tables; row actions with confirm dialogs (reuse the existing `ConfirmActionDialog` pattern from seller dashboard).
- Deep-link everything: listing ↔ seller ↔ audit entries.
- Mobile: usable for triage (status change, remove), but design primarily for desktop ops.

---

## 5. Metrics & stats (what “see everything” means)

### 5.1 Phase 0 — Metrics computable from current schema (no new event tables)

These can power the Overview on day one:

| Metric | Definition |
|--------|------------|
| Listings by status | Counts of `active` / `sold` / `removed` |
| Gowns (variants) by status | `available` vs `sold` across `listing_sizes` |
| Inventory value | Sum of `listing_sizes.price` where `status = 'available'` (and listing not `removed`) |
| New listings (7d / 30d) | `listings.created_at` windows |
| Sold listings (7d / 30d) | Proxy: listings currently `sold` with `created_at` in window is weak; better once `updated_at` or audit exists |
| Active sellers | Distinct `user_id` on non-removed listings |
| New sellers | Distinct first-listing `user_id` in window (proxy until profiles.created_at) |
| Category / location / condition mix | Breakdowns of active inventory |
| Sell-mode mix | `individual` / `set_only` / `either` |
| Avg images per listing | Mean `cardinality(image_urls)` |
| Avg variants per listing | Mean size-row count |
| Price distribution | Min / p50 / p90 / max of available variant prices (reuse price-bounds thinking) |
| Stale active listings | Active + created_at older than N days (needs product definition of “stale”) |
| Soft-removed volume | Count + recent removals |

**Seller dashboard stats today** (`DashboardStats`) are the per-user subset of the above — admin Overview is the global version.

### 5.2 Phase 1 — Schema additions that unlock better ops metrics

| Addition | Why |
|----------|-----|
| `listings.updated_at` (+ trigger) | Sort “recently changed”; time-to-sold approximations |
| `profiles` (+ `created_at`, `last_sign_in_at` sync if available) | Real user counts, bans, roles |
| `admin_audit_log` | Who changed what; also feeds “moderation velocity” |
| Optional `listings.removed_at` / `sold_at` | Cleaner funnel metrics without parsing audit |

### 5.3 Phase 2 — Product analytics (instrumentation)

Nothing is tracked today (no views, no contact clicks, no search logs). Admin “what’s going on” is incomplete without:

| Event | Suggested capture |
|-------|-------------------|
| `listing_impression` | Browse card in viewport or page render (server log of IDs on browse page is coarse but easy) |
| `listing_view` | Detail page load (`/browse/[id]`) |
| `contact_email_click` / `contact_phone_click` | Client beacon or server action before `mailto`/`tel` |
| `listing_create` / `listing_update` / status changes | Already implied by DB; also write audit for admin actions |
| `search_or_filter_use` | Optional: log filter param sets (privacy-conscious aggregation) |

**Storage options:**

1. **First-party tables** (`listing_events` or daily rollups) — full admin control, fits Supabase.
2. **External** (PostHog / Plausible / GA) — faster charts, less custom UI; admin embeds or links out.

**Recommendation:** Start Overview with Phase 0 SQL metrics; add `listing_view` + contact-click counters (per listing, daily rollup) before building a heavy event warehouse. Avoid blocking admin CRUD on analytics.

### 5.4 Overview dashboard widgets (target UI)

1. KPI strip: active listings, available gowns, sold gowns (30d), active sellers, removed (7d).
2. Inventory value + price histogram.
3. Listings created vs sold (time series) — improves after `updated_at` / `sold_at`.
4. Breakdown charts: category, location, condition, sell mode.
5. Attention queue: newest listings, oldest stale actives, recent removals, users with many removed listings.
6. System health: failed image refs count, cache “last revalidated” (ops), auth errors if logged.

---

## 6. Listing management (core god-mode)

### 6.1 List view (`/admin/listings`)

**Columns (suggested):** thumbnail, title, status, category, location, sell mode, variant summary (e.g. `3 avail / 1 sold`), price summary, seller (email or id), `created_at`, `updated_at`, image count.

**Filters:** status (multi), category, location, condition, color, sell mode, price range, date range, seller search, free-text title, “has phone”, “stale”, “sold out variants but listing still active” (data-quality).

**Sort:** created, updated, title, inventory value.

**Row / bulk actions:**

| Action | Behavior |
|--------|----------|
| View public page | Open `/browse/[id]` (only works if still active — else admin detail) |
| Open admin detail | Always |
| Force remove | Set `status = 'removed'` (moderation delist); invalidate `listing:{id}` + `listings` |
| Force restore | `removed` → `active` (or `sold` if all variants sold — define rule) |
| Mark sold / reactivate | Reuse existing RPC semantics (`mark_listing_sold`, `reactivate_listing`) but **admin-owned** variants of RPCs (no `user_id = auth.uid()` owner check; check admin role instead) |
| Hard delete | Confirm + cascade DB row + delete storage objects; irreversible; audit |
| Bulk remove / restore | Same as above, capped batch size |

### 6.2 Detail / edit (`/admin/listings/[id]`)

Admin can edit **any field** sellers can, plus privileged fields:

- All listing columns: title, description, color, location, category, condition, sell_mode, bundle_price, contact_*, status, images.
- All variants: add/remove sizes, prices, sort order, per-size status.
- Re-run or replace images (reuse `optimizeListingPhoto` pipeline).
- See raw IDs, storage paths, seller `user_id`, created/updated.
- Side panel: audit history for this listing; link to seller admin page.

**Implementation note (strategy only):** Existing RPCs (`update_listing_with_variants`, `mark_listing_sold`, etc.) are **owner-scoped** (`user_id = auth.uid()`). Admin needs either:

- Parallel `admin_*` RPCs (`security definer` or invoker + role check), or  
- RLS admin policies + relaxed RPC guards that allow owner **or** admin.

Do not call seller RPCs and hope — they will return “Listing not found” for non-owners.

### 6.3 Status model — extend or not?

Current: `active | sold | removed`.

| Option | Trade-off |
|--------|-----------|
| **Keep three statuses** (recommended for v1) | Admin remove = `removed`; restore = `active`/`sold` by variant state. Simple, matches seller soft-delete. |
| Add `pending_review` | Listings don’t go live until approved — product change to create flow; bigger lift. |
| Add `hidden` separate from `removed` | Distinguishes seller voluntary remove vs admin moderation; clearer analytics, more UI states. |

**Recommendation:** v1 keep three statuses; record `reason` + `actor` in audit when admin removes. Revisit `hidden` / `pending_review` if moderation volume grows.

### 6.4 Image / media actions

- View all slots + blur previews.
- Replace / reorder / delete slot (maintain 1–3 invariant).
- “Delete orphan storage objects” tool: objects in `gown-images` not referenced by any listing.
- “Broken URL” detector: listing `image_urls` pointing at missing storage keys.

---

## 7. User / seller management

No profiles table today — identity is `auth.users` + optional `user_metadata.phone` + per-listing contacts.

### 7.1 User list

**Columns:** email, provider (email/Google), created, last sign-in (if readable via admin Auth API), listing counts by status, banned flag, role.

**Access pattern:** Prefer `profiles` as the app-facing directory; use Supabase Auth Admin API (service role) only for auth-only fields (ban user, delete user, reset factors) inside server actions.

### 7.2 User detail actions

| Action | Notes |
|--------|-------|
| View all their listings | Deep links |
| Impersonation | **Out of scope / dangerous** — prefer “open listing as admin edit” instead of session impersonation |
| Ban / suspend | Block sign-in (Auth ban) + optionally force-remove their active listings |
| Promote / demote admin | Only super-admin or env-bootstrapped first admin |
| Edit metadata phone | Optional |
| Delete user | Cascade deletes listings (FK ON DELETE CASCADE) — destructive; require typed confirm |

### 7.3 Seller quality signals

- Listings removed by admin vs by seller.
- Time-to-first-listing.
- Contact email domain patterns / duplicate contacts across accounts (fraud-ish heuristics — keep light).

---

## 8. Moderation workflow

### v1 (manual, admin-driven)

1. Operator finds bad listing via search, report email, or “newest listings” queue.
2. Opens admin detail → Force remove (and optionally hard-delete images).
3. Optionally ban seller.
4. Everything logged to `admin_audit_log`.

### v2 (product-assisted)

- Public “Report listing” → `listing_reports` table → `/admin/moderation` queue.
- Optional auto-hold: `pending_review` on create for new sellers.
- Image moderation beyond face-blur (manual review queue for Vision failures / NSFW — only if needed).

### Moderation reasons (suggested taxonomy)

`spam`, `wrong_category`, `prohibited_item`, `stolen_suspected`, `contact_abuse`, `image_policy`, `duplicate`, `other` (+ free-text note).

---

## 9. Audit log (non-negotiable for god-mode)

### Table sketch (conceptual)

`admin_audit_log`:

- `id`, `actor_user_id`, `action` (enum/text), `entity_type` (`listing` / `listing_size` / `user` / `storage` / `ops`), `entity_id`, `before` jsonb, `after` jsonb, `reason`, `created_at`, `ip` optional.

### Rules

- Every admin mutation writes an audit row **in the same transaction** as the data change when possible (RPC), or immediately after with best-effort + alerting if insert fails.
- Audit UI is read-only in app; no delete from admin UI.
- Seller self-actions do not need full audit in v1 (optional later); **admin actions always do**.

---

## 10. Ops & platform tools

| Tool | Purpose |
|------|---------|
| Cache revalidation | Expose safe wrappers around existing `updateTag` / `revalidateTag("listings")` (today `revalidateListings` exists but is test-only) |
| Health | Env presence checks (Supabase, Vision) without leaking secrets |
| Links | Supabase dashboard, storage bucket, Auth users |
| Sitemap awareness | Removals must invalidate listing tags so sitemap/browse drop the gown |
| Email templates | Link to `docs/email-templates` + Supabase Auth templates — not edited inside admin |

---

## 11. Permissions matrix (target)

| Capability | Seller | Admin |
|------------|--------|-------|
| Browse active listings | Yes | Yes |
| Create own listing | Yes | Yes (as themselves) |
| Edit own listing | Yes | Yes |
| Edit any listing | No | Yes |
| Soft-remove own | Yes | Yes |
| Soft-remove any | No | Yes |
| Hard delete listing + storage | No | Yes |
| Mark sold / reactivate any | Own only | Any |
| View removed listings | Own (currently hidden from dashboard) | All |
| View all users | No | Yes |
| Ban user | No | Yes |
| View audit log | No | Yes |
| Revalidate cache | No | Yes |
| Manage payment intents | — | Future |

---

## 12. Data model changes (strategy checklist)

Required for a serious admin:

1. **`profiles`** — role, ban flag, timestamps; trigger from `auth.users`.
2. **Admin RLS policies** and/or **`admin_*` RPCs** for listing/variant mutations.
3. **`admin_audit_log`**.
4. **`listings.updated_at`** (and ideally `sold_at` / `removed_at` or derive from audit).
5. Optional: **`listing_reports`**, **`listing_daily_stats`** (views, contact clicks).
6. Env: role bootstrap (`FIRST_ADMIN_EMAIL`) or manual SQL promote; document in auth setup docs.
7. Fold every migration into `schema.sql` per project rules.

**Explicitly deferred:** Stripe wiring to `payment_intents`; in-app messaging tables.

---

## 13. Engineering shape (where code would live — not implementing)

| Area | Placement |
|------|-----------|
| Routes | `src/app/(admin)/admin/...` with own layout |
| Guard | `src/proxy.ts` + server layout role check |
| Actions | `src/lib/actions/admin.ts` (or split `admin-listings.ts` / `admin-users.ts` if large — still domain-grouped) |
| Queries | `src/lib/queries/admin-*.ts` — **uncached** or short-lived; never use public listing cache for removed/cross-seller without separate tags |
| Cache | Mutations call `updateTag("listings")` + `updateTag(\`listing:${id}\`)` like seller flows |
| UI | Colocate under `(admin)/`; shared confirm dialogs from `src/components/` if truly shared |
| Tests | `tests/admin-*.test.ts` covering every exported admin action |

---

## 14. Phased delivery plan

### Phase 1 — Foundation (must ship first)

- Profiles + admin role + route guard + empty `/admin` shell.
- Access path decision locked (RLS vs service-role).
- Audit log table + writer helper.

### Phase 2 — Listing god-mode

- All-listings table + filters.
- Admin detail: view all statuses, force remove/restore, mark sold/reactivate, edit fields/variants/images.
- Tag invalidation parity with seller actions.
- Admin RPCs / policies.

### Phase 3 — Users + moderation queue

- User directory + detail + ban.
- Moderation list (recent removals, reason filters).
- Hard delete + storage cleanup.

### Phase 4 — Metrics Overview

- Phase-0 SQL KPIs + charts.
- Stale / attention queues.
- Ops revalidate tool.

### Phase 5 — Instrumentation

- Listing views + contact click rollups.
- Analytics page or Overview upgrade.

### Phase 6 — Future

- Report-a-listing.
- Approval workflow (`pending_review`).
- Payments admin when Stripe is greenlit.
- CSV export / bulk tools polish.

---

## 15. Security & compliance notes

- Treat admin as a **high-risk surface**: rate-limit mutations if feasible; confirm dialogs for destroy actions; typed confirmation for hard delete / user delete.
- Log actor identity on every action.
- Do not expose other sellers’ contact info on public pages beyond existing listing contacts; admin may see account email + listing contacts.
- Ban should prevent new listings and sign-in.
- Prefer 404 for non-admins hitting `/admin` if you want to avoid advertising the panel.
- Service role key only on server; never in `NEXT_PUBLIC_*`.

---

## 16. Open decisions (resolve before coding)

1. **Access path:** Profiles+RLS (A) vs service-role (B) vs env allowlist MVP (C)?
2. **Non-admin hitting `/admin`:** 404 vs 403?
3. **Status model:** stay with `removed` only, or add `hidden` / `pending_review`?
4. **Seller-removed vs admin-removed:** same status + audit reason, or distinct status?
5. **Hard delete in v1** or soft-remove only until storage orphan tool exists?
6. **Analytics:** first-party tables vs external product analytics?
7. **First admin bootstrap:** SQL one-liner vs `FIRST_ADMIN_EMAIL` env on deploy?
8. **Impersonation:** explicitly never, or “view site as” later?

---

## 17. Success criteria

Admin is “done enough” when an operator can, without touching Supabase SQL:

1. See global inventory and seller activity at a glance.
2. Find any listing in any status and any seller in seconds.
3. Edit or delist any listing and fix variants/images.
4. Ban a bad actor and clean their active inventory.
5. Explain who changed what via audit history.
6. Refresh public caches after emergency edits.
7. Do all of the above without weakening seller RLS for normal users.

---

## 18. Appendix — codebase anchors

| Topic | Location |
|-------|----------|
| Schema | `src/supabase/schema.sql` |
| Seller listing mutations | `src/lib/actions/sell.ts`, `src/lib/actions/listings.ts` |
| Public queries / cache tags | `src/lib/listings-queries.ts` |
| Auth + proxy | `src/lib/actions/auth.ts`, `src/proxy.ts` |
| Types / statuses | `src/lib/types.ts` |
| Seller stats UI | `src/components/DashboardStats.tsx` |
| Contact UX | `src/app/(main)/browse/[id]/` |
| Project rules | `AGENTS.md`, `MEMORY.md` |

---

*This document is a strategy spec only. No admin routes, roles, or migrations have been implemented.*
