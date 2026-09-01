create extension if not exists "uuid-ossp";

create table listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  color text,
  location text,
  category text check (
    category is null
    or category in (
      'bridal',
      'mother-of-the-bride',
      'girls',
      'women',
      'maternity'
    )
  ),
  condition text not null check (condition in ('Brand New', 'Perfect Condition', 'Needs Alterations')),
  sell_mode text not null default 'individual' check (sell_mode in ('individual', 'set_only', 'either')),
  bundle_price numeric(10,2),
  image_urls text[] not null,
  image_blur_data_urls text[] not null,
  contact_email text,
  contact_phone text,
  contact_methods text[] not null default '{}',
  status text default 'active' check (status in ('active', 'sold', 'removed', 'pending_payment', 'suspended')),
  created_at timestamp with time zone default now(),
  -- Lifecycle timestamps behind the admin metrics. sold_at is stamped and
  -- cleared by the status RPCs below; suspended_at is written by
  -- admin_suspend_listing and cleared by admin_restore_listing; updated_at is
  -- maintained by the touch trigger.
  sold_at timestamptz,
  suspended_at timestamptz,
  updated_at timestamptz not null default now(),
  -- Moderation state. previous_status is what makes restore exact: a suspended
  -- pending_payment listing restored to a hardcoded 'active' would be a free
  -- publish, and one suspended out of 'sold' would un-sell a gown.
  suspension_slug text,
  suspension_reason text,
  previous_status text,
  constraint listings_suspension_slug_check check (
    suspension_slug is null
    or suspension_slug in (
      'spam', 'wrong-category', 'prohibited-item',
      'image-policy', 'duplicate', 'other'
    )
  ),
  -- The status guard makes admin_suspend_listing the only door an admin can
  -- use; this makes a malformed suspended row unrepresentable through any door,
  -- including the SQL editor. Neither is redundant: the guard cannot see
  -- whether a reason was supplied, and the constraint cannot see who is
  -- writing. suspension_reason is not null here while the note is optional, so
  -- the RPC falls back to the slug when no note is given and the seller-facing
  -- renderer maps a bare slug to its own sentence. suspension_slug is
  -- deliberately not a term: it is required by the RPC signature and the client
  -- schema, so a fourth term would add no protection.
  -- 'removed' allows previous_status either way: null for a listing removed
  -- before migration 034 existed (never stamped), or set by remove_listing()
  -- since -- not to restore its exact prior status (that stays exclusive to
  -- suspend), only so admin_restore_listing can tell whether the listing had
  -- already gone live before removal, or was still unpaid.
  constraint listings_suspension_fields_check check (
    (status = 'suspended'
       and suspension_reason is not null
       and previous_status is not null)
    or (status = 'removed'
        and suspension_reason is null)
    or (status not in ('suspended', 'removed')
        and suspension_reason is null
        and previous_status is null)
  ),
  constraint listings_image_arrays_check check (
    cardinality(image_urls) between 1 and 3
    and cardinality(image_blur_data_urls) = cardinality(image_urls)
  ),
  constraint listings_bundle_price_check check (
    bundle_price is null
    or (bundle_price > 0 and sell_mode in ('set_only', 'either'))
  ),
  constraint listings_contact_present_check check (
    contact_email is not null or contact_phone is not null
  ),
  constraint listings_contact_methods_values_check check (
    contact_methods <@ array['call', 'text']::text[]
  ),
  constraint listings_contact_methods_need_phone_check check (
    cardinality(contact_methods) = 0 or contact_phone is not null
  )
);

-- One physical gown (size variant) per row; everything else is shared on listings.
create table listing_sizes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  size text not null,
  size_group text not null,
  price numeric(10,2) not null,
  status text not null default 'available',
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint listing_sizes_status_check check (status in ('available', 'sold')),
  constraint listing_sizes_unique_size unique (listing_id, size_group, size),
  constraint listing_sizes_size_pair_check check (
    (size_group = 'toddler' and size in ('2T','3T','4T','5T','6T','7T','8T','9T','10T')) or
    (size_group = 'kids'    and size in ('3','5','6','7','8','10','12','14','16')) or
    (size_group = 'junior'  and size in ('J6','J8','J10','J12','J14','J16','J18')) or
    (size_group = 'adult'   and size in ('0','2','4','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36'))
  )
);

-- Partial indexes covering only active listings for fast filter queries
create index listings_color_active_idx     on listings(color)     where status = 'active';
create index listings_location_active_idx  on listings(location)  where status = 'active';
create index listings_category_active_idx  on listings(category)   where status = 'active';
create index listings_condition_active_idx on listings(condition) where status = 'active';
create index listings_created_active_idx   on listings(created_at desc) where status = 'active';

create index listing_sizes_listing_id_idx on listing_sizes (listing_id);
create index listing_sizes_group_size_available_idx
  on listing_sizes (size_group, size) where status = 'available';
create index listing_sizes_price_available_idx
  on listing_sizes (price) where status = 'available';

-- Full (non-partial) indexes for the admin lists, which sort newest-first
-- across every status and so cannot use the active-only partial indexes above.
create index listings_created_at_idx on listings (created_at desc);
create index listings_sold_at_idx on listings (sold_at) where sold_at is not null;
create index listings_status_idx on listings (status);

-- The seller-ownership policies have always filtered this column, and the
-- storage delete policy for admin-uploaded photos adds a per-object `exists`
-- over the caller's own listings.
create index listings_user_id_idx on listings (user_id);

-- One row per Stripe Checkout attempt for a listing's publishing fee. No
-- update/delete policies for authenticated callers: status transitions are
-- service-role only — `succeeded` via record_listing_payment, `expired` via
-- the Stripe webhook, createListingCheckout (retiring a dead prior session
-- before minting fresh), and removeListing (closing open Checkout so a
-- soft-delete can't leave a payable orphan). Rows ride the listing FK cascade.
create table listing_payments (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index listing_payments_listing_id_idx on listing_payments (listing_id);
create index listing_payments_created_at_idx on listing_payments (created_at desc);
create index listing_payments_user_id_idx on listing_payments (user_id);

-- Contact form submissions. Write-only from the app: insert is granted to anon
-- + authenticated (buyers have no accounts), with no select/update/delete
-- policies — messages are readable only via the Supabase dashboard (and a later
-- admin inbox).
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  created_at timestamp with time zone not null default now(),
  constraint contact_messages_message_length_check check (char_length(message) between 10 and 2000)
);
create index contact_messages_created_at_idx on contact_messages (created_at desc);

-- Buyer wishlist (Phase 2). First buyer-owned table: composite PK makes
-- duplicates impossible (union merge = upsert-ignore); `snapshot` denormalizes
-- the display fields so a sold/removed item still renders on a new device.
create table wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamp with time zone not null default now(),
  primary key (user_id, listing_id)
);
-- The composite PK indexes (user_id, listing_id), so per-listing save counts
-- (the admin saved-count column and most-wishlisted metric) had no index.
create index wishlist_items_listing_id_idx on wishlist_items (listing_id);

-- Activity trail for the whole marketplace, not just admin actions. Append-only:
-- writes arrive only through the audit.write_audit_row() writer below (reached
-- from the triggers and from admin_log_event), and there is deliberately no
-- insert, update, or delete policy.
-- actor_email is denormalized because auth.users has no PostgREST surface, and
-- because an audit row should record who the actor was at the time rather than
-- who that id resolves to now. actor_id nulls out if the account is deleted;
-- the row itself always survives. A 'system' row (Stripe webhook, cleanup
-- sweep) has no JWT and so carries neither actor column.
-- entity_id carries no FK, so rows outlive a hard-deleted listing.
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text not null check (actor_role in ('admin', 'seller', 'system')),
  action text not null,
  entity_type text not null check (entity_type in ('listing', 'user', 'payment')),
  entity_id uuid not null,
  entity_label text not null,
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  -- created_at defaults to now(), the TRANSACTION timestamp, so every row
  -- written by one RPC ties exactly and the order of a cascade ("Size 8 sold"
  -- then "Listing marked sold") would otherwise be undefined. Every read sorts
  -- `created_at desc, sequence desc`.
  sequence bigserial,
  -- A system row names no actor; every other row names one. Deliberately
  -- "id OR email", not "email": auth.users.email is nullable, and requiring the
  -- email would make an email-less signup's audit row unwritable (the auth
  -- trigger swallows, so the row would vanish silently). actor_id alone is also
  -- the state every row reaches after `on delete set null`.
  constraint admin_audit_log_actor_identity check (
    (actor_role = 'system' and actor_id is null and actor_email is null)
    or (actor_role <> 'system' and (actor_id is not null or actor_email is not null))
  )
);
create index admin_audit_log_created_at_idx on admin_audit_log (created_at desc);
create index admin_audit_log_entity_idx on admin_audit_log (entity_type, entity_id);
create index admin_audit_log_actor_id_idx on admin_audit_log (actor_id, created_at desc);
create index admin_audit_log_actor_role_idx on admin_audit_log (actor_role, created_at desc);

insert into storage.buckets (id, name, public) values ('gown-images', 'gown-images', true);

-- The single SQL side of the admin claim check (the TS side is isAdmin()).
-- Role lives in the JWT's app_metadata, which is signed and not user-editable,
-- so this needs no table read. Deliberately NOT revoked from public: it only
-- reflects the caller's own token, so it discloses nothing, and every admin RLS
-- policy below has to be able to evaluate it. Every admin policy wraps it in a
-- subselect so Postgres runs it once per query as an initplan, not per row.
create or replace function is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

alter table listings enable row level security;

create policy "Public can view active listings" on listings for select using (status in ('active', 'sold'));
create policy "Sellers can view own listings" on listings for select using (auth.uid() = user_id);
create policy "Sellers can insert listings" on listings for insert with check (auth.uid() = user_id);
create policy "Sellers can update own listings" on listings for update using (auth.uid() = user_id);
create policy "Sellers can delete own listings" on listings for delete using (auth.uid() = user_id);
-- Admin reads are purely additive to the seller/public policies above, and are
-- scoped `to authenticated` so anonymous browse traffic never evaluates them.
create policy "Admins can view all listings" on listings
  for select to authenticated using ((select is_admin()));
-- No admin delete policy: hard delete is excluded from v1, so granting it would
-- be a privilege nothing uses. An update policy carries an explicit `with
-- check` too, or Postgres reuses `using` as the check and the two drift later.
create policy "Admins can update all listings" on listings
  for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

alter table listing_sizes enable row level security;

create policy "Public can view sizes of active listings" on listing_sizes
  for select using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.status in ('active', 'sold')
    )
  );
create policy "Sellers can view own listing sizes" on listing_sizes
  for select using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.user_id = (select auth.uid())
    )
  );
create policy "Sellers can insert own listing sizes" on listing_sizes
  for insert with check (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.user_id = (select auth.uid())
    )
  );
create policy "Sellers can update own listing sizes" on listing_sizes
  for update using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.user_id = (select auth.uid())
    )
  );
create policy "Sellers can delete own listing sizes" on listing_sizes
  for delete using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.user_id = (select auth.uid())
    )
  );
-- Via the claim directly, not via parent visibility: an admin reads variants of
-- listings in every status, including ones no select policy above exposes.
create policy "Admins can view all listing sizes" on listing_sizes
  for select to authenticated using ((select is_admin()));
-- All three write verbs, not just update: update_listing_with_variants
-- reconciles a size set by deleting, re-pricing, and inserting, so an
-- update-only grant would fail the moment an admin edits which sizes a listing
-- offers.
create policy "Admins can insert listing sizes" on listing_sizes
  for insert to authenticated with check ((select is_admin()));
create policy "Admins can update listing sizes" on listing_sizes
  for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));
create policy "Admins can delete listing sizes" on listing_sizes
  for delete to authenticated using ((select is_admin()));

alter table contact_messages enable row level security;

create policy "Anyone can submit a contact message" on contact_messages
  for insert
  to anon, authenticated
  with check (true);
-- The read-only /admin/messages inbox. Still no update or delete policy.
create policy "Admins can read contact messages" on contact_messages
  for select to authenticated using ((select is_admin()));

alter table wishlist_items enable row level security;

-- Owner-only. No update policy: items are only added and removed. The PK's
-- leading user_id column already indexes owner lookups, so no extra index.
create policy "Owners can view own wishlist items" on wishlist_items
  for select using ((select auth.uid()) = user_id);
create policy "Owners can insert own wishlist items" on wishlist_items
  for insert with check ((select auth.uid()) = user_id);
create policy "Owners can delete own wishlist items" on wishlist_items
  for delete using ((select auth.uid()) = user_id);
-- Aggregate counts only. No admin screen ever renders a named buyer's saved
-- list; this policy exists so save counts and most-wishlisted can be computed.
create policy "Admins can view all wishlist items" on wishlist_items
  for select to authenticated using ((select is_admin()));

alter table listing_payments enable row level security;

create policy "Sellers can insert own payment rows" on listing_payments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from listings l
      where l.id = listing_id and l.user_id = (select auth.uid())
    )
  );
create policy "Sellers can view own payment rows" on listing_payments
  for select using (auth.uid() = user_id);
-- Read-only for admins too: record_listing_payment stays service-role only, so
-- there is deliberately no admin insert, update, or delete policy here.
create policy "Admins can view all payment rows" on listing_payments
  for select to authenticated using ((select is_admin()));

alter table admin_audit_log enable row level security;

-- Select only, by design. See the table comment above: the log is append-only
-- and written exclusively through claim-checked RPCs.
create policy "Admins can read the audit log" on admin_audit_log
  for select to authenticated using ((select is_admin()));

create policy "Public image access" on storage.objects for select using (bucket_id = 'gown-images');
create policy "Auth users can upload images" on storage.objects for insert with check (bucket_id = 'gown-images' and auth.role() = 'authenticated');
create policy "Users can delete own images" on storage.objects for delete using (bucket_id = 'gown-images' and auth.uid() = owner);
-- Without this an admin cannot remove another seller's photo at all: the owner
-- policy above is the bucket's only delete grant.
create policy "Admins can delete listing images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gown-images' and (select is_admin()));

-- An object an admin uploaded for a seller's listing is owned by the ADMIN, so
-- the owner policy above refuses the seller who later removes that photo from
-- their own dashboard: the row goes correct and the file is stranded.
--
-- Provenance comes from the PATH, never from `listings.image_urls`. That column
-- is seller-writable (update_listing_with_variants is granted to authenticated
-- and assigns it straight from client jsonb), so a policy keyed on it lets a
-- seller plant another seller's URL in their own listing and delete a
-- stranger's object. A seller cannot move an object into a different prefix,
-- so `admin/<listing_id>/` is a claim only this application can make.
--
-- Objects written before migration 036 have flat paths and are not covered;
-- those stay with the orphan sweep.
create policy "Sellers can delete admin photos on their own listings"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gown-images'
  and name like 'admin/%'
  and exists (
    select 1
      from public.listings l
     where l.user_id = (select auth.uid())
       and starts_with(storage.objects.name, 'admin/' || l.id::text || '/')
  )
);

-- Atomic "mark listing sold": flip the listing status and all of its size
-- variants in one transaction, so a mid-way failure can't leave the listing
-- sold while some variants stay available. Guarded to active-only so a
-- pending/removed listing can't be routed to sold (see reactivate_listing's
-- sold-only guard below for the matching half of this bypass close).
-- app.audit_cascade tells audit_listing_size_change() that the variant rewrite
-- below belongs to the listing-level row this already logged, so a three-size
-- listing produces one audit row rather than four.
create or replace function mark_listing_sold(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  -- Admins reach every status transition by widening the four seller RPCs
  -- rather than by cloning them, so the transition guards, the audit-cascade
  -- suppression, and the write-order dependency exist once. The predicate stays
  -- inline, so an unrelated seller still gets 'Listing not found' and learns
  -- nothing about what exists.
  v_is_admin boolean := (select public.is_admin());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform set_config('app.status_write', 'on', true);

  update public.listings
     set status = 'sold', sold_at = now()
   where id = p_listing_id
     and (user_id = v_uid or v_is_admin)
     and status = 'active';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  perform set_config('app.audit_cascade', p_listing_id::text, true);

  update public.listing_sizes
     set status = 'sold'
   where listing_id = p_listing_id;

  -- One-shot: cleared right after the cascading statement, not left to end of
  -- transaction. A later legitimate variant change to the same listing in the
  -- same transaction (SQL-editor work, or a future wrapper RPC) would otherwise
  -- read as part of this cascade and go unlogged. It cannot be cleared inside
  -- the row trigger, which would unsuppress the rest of this cascade.
  perform set_config('app.audit_cascade', '', true);
  perform set_config('app.status_write', '', true);
end;
$$;

grant execute on function mark_listing_sold(uuid) to authenticated;

-- Atomic "reactivate listing": flip the listing status back to active and all
-- of its size variants back to available in one transaction, undoing a
-- mark-sold so a mid-way failure can't leave the listing active while some
-- variants stay sold. Guarded to sold-only: without it, a replayed
-- mark_listing_sold on a pending_payment listing (pending -> sold) followed
-- by this RPC (sold -> active) would publish the listing without paying.
create or replace function reactivate_listing(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := (select public.is_admin());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform set_config('app.status_write', 'on', true);

  -- sold_at clears: the listing is on the market again, so it must not count
  -- as a sale in the time-series or drag the median time-to-sold.
  update public.listings
     set status = 'active', sold_at = null
   where id = p_listing_id
     and (user_id = v_uid or v_is_admin)
     and status = 'sold';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  perform set_config('app.audit_cascade', p_listing_id::text, true);

  update public.listing_sizes
     set status = 'available'
   where listing_id = p_listing_id;

  -- One-shot, same reasoning as mark_listing_sold above.
  perform set_config('app.audit_cascade', '', true);
  perform set_config('app.status_write', '', true);
end;
$$;

grant execute on function reactivate_listing(uuid) to authenticated;

-- Atomic "mark size sold" with listing-status sync: mark one variant sold and,
-- if it was the last available variant, flip the parent listing to 'sold' in the
-- same transaction. Keeps listings.status consistent with its variants so a
-- listing sold off one size at a time disappears from browse exactly like one
-- sold via mark_listing_sold. Ownership is enforced by RLS on listing_sizes
-- (via parent) for the size update, and by the explicit user_id guard on the
-- listing update. Guarded to an active parent for consistency with the two
-- RPCs above, though its cascade only ever sets 'sold', never 'active'.
create or replace function mark_size_sold(p_listing_id uuid, p_size_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := (select public.is_admin());
  v_count int;
  v_available int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform set_config('app.status_write', 'on', true);

  update public.listing_sizes ls
     set status = 'sold'
   where ls.id = p_size_id
     and ls.listing_id = p_listing_id
     and exists (
       select 1 from public.listings l
        where l.id = ls.listing_id and l.status = 'active'
     );

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Size not found' using errcode = 'P0002';
  end if;

  select count(*) into v_available
    from public.listing_sizes
   where listing_id = p_listing_id and status = 'available';

  -- Selling off the last variant is a sale like any other, so it stamps
  -- sold_at exactly as mark_listing_sold does. The parent predicate needs the
  -- same widening as the variant update above, or an admin selling the last
  -- variant flips the size while the listing silently stays active, which is
  -- exactly the divergence this RPC exists to prevent.
  if v_available = 0 then
    update public.listings
       set status = 'sold', sold_at = now()
     where id = p_listing_id
       and (user_id = v_uid or v_is_admin);
  end if;

  -- After the `if`, not inside it: the parent update is the last status
  -- statement on the path that has one, and the other path has none.
  perform set_config('app.status_write', '', true);
end;
$$;

-- Soft-remove a listing. The status write lives here rather than in the server
-- action because guard_listing_status_write() refuses direct status writes; the
-- Stripe session expiry stays in removeListing, since it cannot join this
-- transaction.
-- Widened for an admin caller (migration 034), exactly like the four seller
-- RPCs in migration 030: an admin removes a listing on the seller's own
-- explicit request ("take it down for good"), never as moderation, which is
-- what admin_suspend_listing is for. `<> 'suspended'` closes the seller's own
-- escape from moderation state, and now also stops an admin removal from
-- overwriting a suspension's own previous_status. previous_status is stamped
-- again as of migration 034 -- not to restore the listing's exact prior
-- status (that stays exclusive to suspend), only so admin_restore_listing can
-- tell whether the listing had already gone live before removal, or was
-- still pending_payment and must not restore straight to active for free.
create or replace function remove_listing(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := (select public.is_admin());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  perform set_config('app.status_write', 'on', true);

  update public.listings
     set status = 'removed',
         previous_status = status
   where id = p_listing_id
     and (user_id = v_uid or v_is_admin)
     and status <> 'removed'
     and status <> 'suspended';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  perform set_config('app.status_write', '', true);
end;
$$;

revoke execute on function remove_listing(uuid) from public;
grant execute on function remove_listing(uuid) to authenticated;

grant execute on function mark_size_sold(uuid, uuid) to authenticated;

-- Mirrors mark_size_sold, including where the precondition lives: the active
-- parent is a predicate on the UPDATE itself, not a separate read, so a suspend
-- or a mark-sold landing between the two cannot leave one variant available
-- under a non-active listing. Ownership is RLS's job here, exactly as there,
-- which is also what lets an admin call it for another seller.
create or replace function reactivate_size(p_listing_id uuid, p_size_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := (select public.is_admin());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.listing_sizes ls
     set status = 'available'
   where ls.id = p_size_id
     and ls.listing_id = p_listing_id
     and exists (
       select 1 from public.listings l
        where l.id = ls.listing_id and l.status = 'active'
     );

  get diagnostics v_count = row_count;
  if v_count > 0 then
    return;
  end if;

  -- Only to tell the caller which precondition failed. Scoped to the same
  -- ownership-or-admin authority as the UPDATE above, not RLS's broader
  -- "Public can view sizes of active listings" read policy, or an active
  -- listing would leak "not active" to a caller with no rights to it at all.
  -- A row invisible under THAT authority reads as not found, so an unrelated
  -- seller still learns nothing about what exists.
  if exists (
    select 1 from public.listing_sizes ls
     where ls.id = p_size_id and ls.listing_id = p_listing_id
       and exists (
         select 1 from public.listings l
          where l.id = ls.listing_id and (l.user_id = v_uid or v_is_admin)
       )
  ) then
    raise exception 'Listing is not active' using errcode = '55000';
  end if;

  raise exception 'Size not found' using errcode = 'P0002';
end;
$$;

revoke execute on function reactivate_size(uuid, uuid) from public;
grant execute on function reactivate_size(uuid, uuid) to authenticated;

-- Atomic listing-fee activation: flips a listing_payments row to 'succeeded'
-- and its parent listing to 'active' in one transaction. Idempotent (safe for
-- the webhook and the success-page fast path to call concurrently or in
-- either order). Restricted to service_role: the webhook carries no user
-- session, and RLS correctly blocks anonymous status writes, so activation
-- is confined to code paths that have already verified the event/session
-- against Stripe's own API — never reachable from a seller session directly.
create or replace function record_listing_payment(p_session_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_already_succeeded boolean;
begin
  -- Service-role only, enforced HERE and not by the revoke below. Supabase's
  -- default privileges grant execute to anon/authenticated/service_role by
  -- name, which a revoke aimed at PUBLIC does not touch (measured), so a seller
  -- can still reach this function. Every real user session has a subject; the
  -- service role has none. An anon caller also passes and is inert: both writes
  -- below are refused by RLS.
  if (select auth.uid()) is not null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select listing_id, (status = 'succeeded')
    into v_listing_id, v_already_succeeded
    from public.listing_payments
   where stripe_session_id = p_session_id;

  if v_listing_id is null then
    raise exception 'Listing payment not found' using errcode = 'P0002';
  end if;

  if not v_already_succeeded then
    update public.listing_payments
       set status = 'succeeded', paid_at = now()
     where stripe_session_id = p_session_id;
  end if;

  update public.listings
     set status = 'active'
   where id = v_listing_id and status = 'pending_payment';

  -- A listing suspended while its Checkout was still open can have the fee land
  -- afterwards. The moderation state must hold, so status is not touched; what
  -- moves is the restore TARGET, because restoring a paid listing to
  -- pending_payment would offer its seller Checkout a second time and charge
  -- them twice. Leaves the suspension columns populated, so
  -- listings_suspension_fields_check still holds, and changes nothing the audit
  -- snapshot reads, so it writes no spurious edit row.
  update public.listings
     set previous_status = 'active'
   where id = v_listing_id
     and status = 'suspended'
     and previous_status = 'pending_payment';
end;
$$;

revoke execute on function record_listing_payment(text) from public;
grant execute on function record_listing_payment(text) to service_role;

-- Atomic listing edit: update the shared listing row and reconcile its size
-- variants (delete removed, re-price/re-order kept ones while preserving their
-- status, insert new ones) in a single transaction. Image upload and cleanup
-- stay in the server action because storage writes can't participate in the
-- database transaction.
--
-- The variant reconcile never touches `status`, and audit_listing_size_change()
-- fires on status alone, so adding, removing, re-pricing, or reordering a size
-- would log nothing. The variant set is captured either side of the reconcile
-- and handed to the listing trigger through app.audit_variants, which folds it
-- into that one listing.edit row. The listing UPDATE therefore runs LAST: an
-- `after row` trigger fires when its statement completes, so with the listing
-- written first the diff would not exist yet.
create or replace function update_listing_with_variants(
  p_listing_id uuid,
  p_listing jsonb,
  p_variants jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_variants_before jsonb;
  v_variants_after jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select user_id into v_owner from public.listings where id = p_listing_id;

  if v_owner is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  -- Admins edit a listing in any status for free here: this RPC never touches
  -- status, so an admin edit is not an implicit status change and
  -- guard_listing_status_write never fires.
  if v_owner <> v_uid and not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object('size', size, 'price', price)
                   order by size_group, sort_order)
    into v_variants_before
    from public.listing_sizes where listing_id = p_listing_id;

  -- Remove variants that are no longer submitted.
  delete from public.listing_sizes ls
   where ls.listing_id = p_listing_id
     and not exists (
       select 1
         from jsonb_to_recordset(p_variants)
           as d(size text, size_group text, price numeric, sort_order int)
        where d.size_group = ls.size_group and d.size = ls.size
     );

  -- Re-price / re-order kept variants; their sold/available status is preserved.
  update public.listing_sizes ls set
    price      = d.price,
    sort_order = d.sort_order
  from jsonb_to_recordset(p_variants)
    as d(size text, size_group text, price numeric, sort_order int)
  where ls.listing_id = p_listing_id
    and d.size_group = ls.size_group
    and d.size = ls.size
    and (ls.price is distinct from d.price
         or ls.sort_order is distinct from d.sort_order);

  -- Insert newly added variants (status defaults to 'available').
  insert into public.listing_sizes (listing_id, size, size_group, price, sort_order)
  select p_listing_id, d.size, d.size_group, d.price, d.sort_order
    from jsonb_to_recordset(p_variants)
      as d(size text, size_group text, price numeric, sort_order int)
   where not exists (
     select 1 from public.listing_sizes ls
      where ls.listing_id = p_listing_id
        and ls.size_group = d.size_group
        and ls.size = d.size
   );

  select jsonb_agg(jsonb_build_object('size', size, 'price', price)
                   order by size_group, sort_order)
    into v_variants_after
    from public.listing_sizes where listing_id = p_listing_id;

  if v_variants_before is distinct from v_variants_after then
    perform set_config('app.audit_variants',
      jsonb_build_object('before', v_variants_before,
                         'after',  v_variants_after)::text, true);
  end if;

  update public.listings set
    title                = p_listing->>'title',
    description          = p_listing->>'description',
    color                = p_listing->>'color',
    location             = p_listing->>'location',
    condition            = p_listing->>'condition',
    category             = p_listing->>'category',
    sell_mode            = p_listing->>'sell_mode',
    bundle_price         = (p_listing->>'bundle_price')::numeric,
    -- The admin edit path omits both keys entirely to preserve the current
    -- photos: only reading a stale array a beat before this UPDATE runs could
    -- resurrect a URL another admin's concurrent removal just deleted from
    -- storage. Absent key => keep the row's own current value (migration 033).
    image_urls           = case when p_listing ? 'image_urls'
      then array(select jsonb_array_elements_text(p_listing->'image_urls'))
      else image_urls end,
    image_blur_data_urls = case when p_listing ? 'image_blur_data_urls'
      then array(select jsonb_array_elements_text(p_listing->'image_blur_data_urls'))
      else image_blur_data_urls end,
    contact_email        = p_listing->>'contact_email',
    contact_phone        = p_listing->>'contact_phone',
    contact_methods      = array(select jsonb_array_elements_text(p_listing->'contact_methods'))
  where id = p_listing_id;

  -- One-shot, like app.audit_cascade above: the listing trigger has consumed
  -- it by now, so clearing it keeps a later write in the same transaction from
  -- inheriting a stale diff and logging an edit that never happened.
  perform set_config('app.audit_variants', '', true);
end;
$$;

grant execute on function update_listing_with_variants(uuid, jsonb, jsonb) to authenticated;

-- Existence check for wishlist merge-on-sign-in. A buyer's RLS view of listings
-- only shows active/sold/own rows, so a plain select can't tell a `removed`
-- listing (keep it) from a hard-deleted one (drop it, or the wishlist_items FK
-- insert fails). This security-definer read returns the subset of the given ids
-- that physically exist, regardless of status or RLS, so mergeWishlist keeps
-- sold/removed items and drops only truly-gone ids. Safe: it only confirms
-- existence of ids the caller already holds.
create or replace function existing_listing_ids(p_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from public.listings where id = any (p_ids);
$$;

grant execute on function existing_listing_ids(uuid[]) to authenticated;

-- Keeps listings.updated_at honest for the admin "recently changed" sorting
-- without every write path having to remember to set it.
create or replace function touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch_updated_at
  before update on listings
  for each row execute function touch_updated_at();

-- Closes the listing-fee bypass. The seller UPDATE policy is
-- `using (auth.uid() = user_id)` with no `with check`, and Postgres reuses
-- `using` as the check, so a seller could PATCH any column on their own row,
-- status included, and publish a pending_payment listing for free in one
-- request. Migration 021's fee guards went inside the status RPCs, not onto the
-- table, so the direct write was never covered.
--
-- A status change is allowed only from: a caller with no JWT subject (service
-- role, i.e. the Stripe confirm, the webhook, the sweep; RLS already blocks
-- anon because the seller policy needs auth.uid() = user_id), or a
-- transaction-local flag that only the status RPCs set. The flag is not
-- forgeable from a client: set_config is in pg_catalog and PostgREST exposes
-- only the exposed schema, and is_local scopes it to the request's own
-- transaction.
--
-- An admin claim is deliberately NOT a third door. With the admin update policy
-- on listings in place, trusting the claim here would let a raw PostgREST PATCH
-- set status = 'suspended' with no reason, no previous_status, and no
-- suspended_at, leaving admin_restore_listing nothing to restore to. Admins go
-- through the status RPCs like everyone else.
--
-- app.status_write is ONE-SHOT: every RPC that opens it closes it once its own
-- status statements are done, because set_config's third argument scopes the
-- setting to the TRANSACTION, not the statement, so a flag left on hands the
-- next statement in that transaction the same permission. The reset always
-- sits after `get diagnostics`, never between it and its update: set_config is
-- itself a statement and would overwrite row_count. Failure paths need no
-- handler, since an aborted (sub)transaction rolls the GUC back with it.
create or replace function guard_listing_status_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if coalesce(current_setting('app.status_write', true), '') = 'on' then
    return new;
  end if;

  raise exception
    'Listing status cannot be changed directly; use the listing actions'
    using errcode = '42501';
end;
$$;

create trigger listings_guard_status
  before update on listings
  for each row execute function guard_listing_status_write();

-- Activity log writer and triggers (docs/activity-log-spec.md). Triggers are the
-- only writer for anything that changes a row, so every write is captured
-- regardless of which code path, client, or human produced it, including SQL
-- editor surgery. Intent is derived from the transition because the status
-- vocabulary is small and each transition has exactly one meaning; the two
-- things a trigger cannot see (a moderation reason, and that four variant rows
-- were one edit) arrive through transaction-local GUCs, the same mechanism
-- guard_listing_status_write() already uses for app.status_write.
--
-- The writer lives in a private `audit` schema rather than relying on a revoke:
-- Supabase's default privileges grant execute to anon/authenticated/service_role
-- BY NAME, which a revoke aimed at PUBLIC does not touch (measured), and this
-- function takes a caller-supplied actor, so an exposed one would let a seller
-- forge rows against another person's identity.
create schema if not exists audit;
revoke all on schema audit from public, anon, authenticated, service_role;

-- security definer so it can write to a table with no insert policy. Must be
-- owned by postgres: definer bypasses RLS only through the owner's rights, and
-- the cascade probe plus the auth.users reads depend on that. Actor identity is
-- derived here, never passed in except by the auth trigger, which fires before
-- any session exists.
create or replace function audit.write_audit_row(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_label text,
  p_before jsonb,
  p_after jsonb,
  p_reason text default null,
  p_actor_id uuid default null,
  p_actor_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_actor_id, (select auth.uid()));
  v_email text := coalesce(p_actor_email, (select auth.jwt() ->> 'email'));
  v_role text;
begin
  if v_uid is null then
    v_role := 'system';
    v_email := null;
  elsif p_actor_id is not null then
    -- The auth trigger has no session to derive a role from, so read it off the
    -- subject's own row. app_metadata is signed and not user-editable, and this
    -- function's definer rights are what make the auth.users read possible.
    -- Without it an admin changing their own password logs as a seller, which
    -- is exactly the distinction the actor column exists to make.
    select case when (u.raw_app_meta_data ->> 'role') = 'admin'
             then 'admin' else 'seller' end
      into v_role
      from auth.users u
     where u.id = p_actor_id;
    v_role := coalesce(v_role, 'seller');
  elsif (select public.is_admin()) then
    v_role := 'admin';
  else
    v_role := 'seller';
  end if;

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_role, action,
    entity_type, entity_id, entity_label, reason, before, after
  ) values (
    case when v_role = 'system' then null else v_uid end,
    v_email, v_role, p_action,
    p_entity_type, p_entity_id,
    -- entity_label is not null. auth.users.email is nullable, and a null here
    -- would abort the very write being audited.
    coalesce(nullif(p_entity_label, ''), p_entity_id::text),
    coalesce(p_reason, nullif(current_setting('app.audit_reason', true), '')),
    p_before, p_after
  );
end;
$$;

revoke execute on function audit.write_audit_row(
  text, text, uuid, text, jsonb, jsonb, text, uuid, text
) from public, anon, authenticated, service_role;

-- Columns worth a diff. The description is truncated and the photos reduce to a
-- count plus a digest so a jsonb snapshot stays under a kilobyte; everything
-- else is short by construction. Excludes updated_at and sold_at, which change
-- on writes that are not themselves events.
create or replace function audit_listing_snapshot(l public.listings)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', l.status,
    'title', l.title,
    'description', left(coalesce(l.description, ''), 200),
    'category', l.category,
    'location', l.location,
    'condition', l.condition,
    'color', l.color,
    'sell_mode', l.sell_mode,
    'bundle_price', l.bundle_price,
    'contact_email', l.contact_email,
    'contact_phone', l.contact_phone,
    'contact_methods', to_jsonb(l.contact_methods),
    -- The digest is not redundant with the count: swapping or reordering all
    -- three photos leaves a count identical, the snapshot identical, and the
    -- edit unlogged. md5 keeps the row small and still moves with the images.
    'image_count', coalesce(array_length(l.image_urls, 1), 0),
    'image_digest', md5(array_to_string(l.image_urls, ','))
  );
$$;

create or replace function audit_listing_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_variants jsonb;
  v_action text;
begin
  if tg_op = 'INSERT' then
    perform audit.write_audit_row(
      'listing.create', 'listing', new.id, new.title,
      null, public.audit_listing_snapshot(new)
    );
    return null;
  end if;

  if tg_op = 'DELETE' then
    -- The sweep runs service-role with no session, so a null auth.uid() is what
    -- separates it from a seller-initiated delete (createListing rolls its own
    -- insert back when the variant insert fails, and that must not be reported
    -- as an unpaid-listing sweep).
    perform audit.write_audit_row(
      case when old.status = 'pending_payment' and (select auth.uid()) is null
        then 'listing.purge' else 'listing.delete' end,
      'listing', old.id, old.title,
      public.audit_listing_snapshot(old), null
    );
    return null;
  end if;

  v_before := public.audit_listing_snapshot(old);
  v_after := public.audit_listing_snapshot(new);

  -- A listing edit is one semantic event, so it gets one row. The trigger can
  -- see that four variant rows changed but not that they were one edit, so
  -- update_listing_with_variants hands the variant diff over through this GUC
  -- and it folds into the same before/after.
  v_variants := nullif(current_setting('app.audit_variants', true), '')::jsonb;
  if v_variants is not null then
    v_before := v_before || jsonb_build_object('variants', v_variants -> 'before');
    v_after := v_after || jsonb_build_object('variants', v_variants -> 'after');
  end if;

  if v_before = v_after then
    return null;  -- touch_updated_at and sold_at-only writes produce no row
  end if;

  if old.status is distinct from new.status then
    v_action := case
      when new.status = 'sold' then 'listing.mark_sold'
      when new.status = 'removed' then 'listing.remove'
      when new.status = 'suspended' then 'listing.suspend'
      -- Restoring out of 'removed' also classifies as restore (migration 034):
      -- 'new.status = removed' above is checked first, so an ordinary remove
      -- keeps classifying as 'listing.remove' regardless of who calls it. This
      -- only adds the reverse direction, and nothing but admin_restore_listing
      -- can produce that transition today.
      when old.status in ('suspended', 'removed') then 'listing.restore'
      when old.status = 'sold' and new.status = 'active' then 'listing.reactivate'
      -- pending_payment -> active has two causes and they are not the same
      -- event. A paid activation is already told by payment.succeeded, so a row
      -- here would double every sale. A free publication (fee 0 or payments
      -- suspended) writes no payment row at all, so suppressing it here would
      -- lose the moment that listing went live.
      when old.status = 'pending_payment' and new.status = 'active' then (
        case when exists (
          select 1 from public.listing_payments p
           where p.listing_id = new.id and p.status = 'succeeded'
        ) then null else 'listing.publish_free' end
      )
      else 'listing.status_change'
    end;
  else
    v_action := 'listing.edit';
  end if;

  -- A status-stable update classifies as 'listing.edit', which would file a
  -- photo removal under the wrong slug even though image_count and
  -- image_digest move correctly in the diff. admin_remove_listing_image sets
  -- this override, same mechanism and same one-shot rules as app.audit_reason
  -- and app.audit_variants. Read before the null check, so an override still
  -- emits a row in a transition this trigger would otherwise suppress.
  v_action := coalesce(
    nullif(current_setting('app.audit_action', true), ''), v_action
  );

  if v_action is null then
    return null;
  end if;

  perform audit.write_audit_row(
    v_action, 'listing', new.id, new.title, v_before, v_after
  );
  return null;
end;
$$;

-- Fires after touch_updated_at and guard_listing_status_write (both `before`),
-- so it always sees the final row.
create trigger listings_audit
  after insert or update or delete on listings
  for each row execute function audit_listing_change();

create or replace function audit_listing_size_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if old.status is not distinct from new.status then
    return null;
  end if;

  -- A listing-level action (mark sold, reactivate) rewrites every variant in
  -- the same transaction and has already logged one row that says so. The
  -- cascading RPCs declare that explicitly rather than the trigger guessing
  -- from timestamps, which would swallow a real variant event in any
  -- transaction that logged an unrelated listing edit first. mark_size_sold
  -- deliberately does not set it: its variant row and its listing cascade are
  -- both real events, and the pair reads better than either alone.
  if coalesce(current_setting('app.audit_cascade', true), '') = new.listing_id::text then
    return null;
  end if;

  select title into v_title from public.listings where id = new.listing_id;

  perform audit.write_audit_row(
    case when new.status = 'sold'
      then 'listing.size_sold' else 'listing.size_reactivate' end,
    'listing', new.listing_id, v_title,
    jsonb_build_object('size', old.size, 'variant_status', old.status),
    jsonb_build_object('size', new.size, 'variant_status', new.status)
  );
  return null;
end;
$$;

-- DELETE is deliberately uncovered here and on payments: a swept listing
-- cascades its variants and payment rows away, and one listing.purge row tells
-- the whole story where N cascade rows would bury it.
create trigger listing_sizes_audit
  after update on listing_sizes
  for each row execute function audit_listing_size_change();

create or replace function audit_listing_payment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return null;
  end if;

  select title into v_title from public.listings where id = new.listing_id;

  perform audit.write_audit_row(
    case
      when tg_op = 'INSERT' then 'payment.checkout_start'
      when new.status = 'succeeded' then 'payment.succeeded'
      when new.status = 'expired' then 'payment.expired'
      -- The table constrains values, not transitions. A hand-run repair in the
      -- SQL editor is exactly the case triggers exist for, so it must not be
      -- silently mislabelled as an expiry.
      else 'payment.status_change'
    end,
    -- entity_id is the LISTING id, not the payment id, so payment events can
    -- reach the per-listing timeline (getAuditLogForListing).
    'payment', new.listing_id, v_title,
    case when tg_op = 'INSERT' then null
      else jsonb_build_object('payment_status', old.status) end,
    jsonb_build_object(
      'payment_status', new.status, 'amount_cents', new.amount_cents
    )
  );
  return null;
end;
$$;

create trigger listing_payments_audit
  after insert or update on listing_payments
  for each row execute function audit_listing_payment_change();

-- The handful of admin actions that change no row at all (force sign-out,
-- account delete, payment rescue). An admin can only write rows attributed to
-- themselves, which is not an escalation: they can already perform the actions
-- those rows describe. Sellers still have no write path into the table.
create or replace function admin_log_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_label text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  perform audit.write_audit_row(
    p_action, p_entity_type, p_entity_id, p_entity_label, null, null, p_reason
  );
end;
$$;

revoke execute on function admin_log_event(text, text, uuid, text, text) from public;
grant execute on function admin_log_event(text, text, uuid, text, text) to authenticated;

-- Sign-up and credential changes only. Sign-in is deliberately excluded: it is
-- the highest-volume event on the site and last_sign_in_at on /admin/users
-- already answers the question an operator actually asks. user.signup fires at
-- row insert, which is BEFORE email confirmation, so it means "account
-- created", not "account verified". A password reset through the emailed link
-- updates encrypted_password like any other change and logs identically, which
-- is correct for an audit log: it records that the credential changed, not
-- which door was used. The subject is recorded as the actor, accurate while all
-- three events are self-service; when Phase 3 adds admin account actions, split
-- subject from actor rather than widening this trigger.
create or replace function audit_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform audit.write_audit_row(
      'user.signup', 'user', new.id, new.email, null,
      jsonb_build_object('provider', new.raw_app_meta_data ->> 'provider'),
      null, new.id, new.email
    );
    return null;
  end if;

  -- coalesced, not raw: GoTrue inserts a passwordless (OAuth) user with '' and
  -- updates it to null inside the same signup transaction, which a raw
  -- `is distinct from` logs as a credential change that never happened.
  if coalesce(old.encrypted_password, '')
       is distinct from coalesce(new.encrypted_password, '') then
    perform audit.write_audit_row(
      'user.password_change', 'user', new.id, new.email,
      null, null, null, new.id, new.email
    );
  end if;

  if old.email is distinct from new.email then
    perform audit.write_audit_row(
      'user.email_change', 'user', new.id, new.email,
      jsonb_build_object('email', old.email),
      jsonb_build_object('email', new.email),
      null, new.id, new.email
    );
  end if;

  return null;
exception
  -- Auth availability outranks audit completeness on this one table. An `after`
  -- trigger runs in the signup's own transaction, so any raise here would abort
  -- the registration or password reset that fired it. Losing one audit row is
  -- recoverable; a seller who cannot create an account is not. Scoped to
  -- auth.users alone: the listings, variant, and payment triggers stay strict,
  -- because there the row change and its audit row belong in one transaction.
  when others then
    raise warning 'audit_auth_user_change failed for %: %', new.id, sqlerrm;
    return null;
end;
$$;

-- Must be created as postgres (the Supabase SQL editor already is). This is the
-- one statement here touching a schema the project does not own; if a future
-- Supabase change breaks it, listings and payments logging is unaffected.
create trigger auth_users_audit
  after insert or update on auth.users
  for each row execute function audit_auth_user_change();

-- Overview tiles in one round trip. security definer because auth.users has no
-- PostgREST surface and holds the user counts; the is_admin() guard is the
-- gate, and only aggregates ever leave the function. Execute is revoked from
-- public first: Postgres grants it by default, so the grant alone restricts
-- nothing (see record_listing_payment above).
create or replace function admin_overview_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_listings jsonb;
  v_gowns bigint;
  v_users jsonb;
  v_fees bigint;
  v_oldest_hours numeric;
  v_messages bigint;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'active_listings',       count(*) filter (where status = 'active'),
    'sold_listings',         count(*) filter (where status = 'sold'),
    'suspended_or_removed',  count(*) filter (where status in ('suspended', 'removed')),
    'pending_payment',       count(*) filter (where status = 'pending_payment'),
    'new_listings_this_week', count(*) filter (where created_at >= now() - interval '7 days'),
    'sold_this_week',        count(*) filter (where sold_at >= now() - interval '7 days')
  ) into v_listings
  from public.listings;

  select count(*) into v_gowns from public.listing_sizes;

  select jsonb_build_object(
    'users_total',        count(*),
    'new_users_this_week', count(*) filter (where created_at >= now() - interval '7 days')
  ) into v_users
  from auth.users;

  select coalesce(sum(amount_cents), 0) into v_fees
    from public.listing_payments
   where status = 'succeeded' and paid_at >= now() - interval '7 days';

  select
    extract(epoch from (now() - min(created_at))) / 3600,
    count(*)
    into v_oldest_hours, v_messages
    from public.contact_messages;

  return v_listings
    || v_users
    || jsonb_build_object(
         'total_gowns', v_gowns,
         'fees_collected_this_week_cents', v_fees,
         'contact_messages_total', v_messages,
         'oldest_contact_message_age_hours',
           case when v_oldest_hours is null then null else floor(v_oldest_hours) end
       );
end;
$$;

revoke execute on function admin_overview_stats() from public;
grant execute on function admin_overview_stats() to authenticated;

-- Resolves seller emails for a page of listings or payments. auth.users has no
-- PostgREST surface, and the Auth Admin API has no batch get-by-ids, so the
-- alternative was listing every user on every page render. Scoped to ids the
-- caller already has on screen and returns nothing but id and email, so it
-- discloses strictly less than the Users page it links to.
create or replace function admin_user_emails(p_ids uuid[])
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text from auth.users u where u.id = any (p_ids);
end;
$$;

revoke execute on function admin_user_emails(uuid[]) from public;
grant execute on function admin_user_emails(uuid[]) to authenticated;

-- One JSON object avoids PostgREST's row cap while exposing only aggregate
-- counts, never the buyer identities behind them.
create or replace function admin_wishlist_counts(p_listing_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_object_agg(counts.listing_id, counts.saved_count),
      '{}'::jsonb
    )
    from (
      select w.listing_id, count(*) as saved_count
      from public.wishlist_items w
      where w.listing_id = any (p_listing_ids)
      group by w.listing_id
    ) counts
  );
end;
$$;

revoke execute on function admin_wishlist_counts(uuid[]) from public;
grant execute on function admin_wishlist_counts(uuid[]) to authenticated;

-- Weekly time series for /admin/metrics. Weeks are generated so a quiet week
-- renders as a zero rather than vanishing from the chart and compressing the
-- x-axis. security definer for the same auth.users reason as above.
create or replace function admin_metrics_series(p_weeks integer default 12)
returns table (
  week_start date,
  listings_created bigint,
  listings_sold bigint,
  new_users bigint,
  fees_collected_cents bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_weeks is null or p_weeks < 1 or p_weeks > 104 then
    raise exception 'Week count out of range' using errcode = '22023';
  end if;

  return query
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => p_weeks - 1),
      date_trunc('week', now()),
      interval '1 week'
    ) as bucket
  ),
  bounds as (
    select min(bucket) as range_start,
           max(bucket) + interval '1 week' as range_end
    from weeks
  ),
  listing_creations as (
    select date_trunc('week', l.created_at) as bucket, count(*) as count
    from public.listings l cross join bounds b
    where l.created_at >= b.range_start and l.created_at < b.range_end
    group by 1
  ),
  listing_sales as (
    select date_trunc('week', l.sold_at) as bucket, count(*) as count
    from public.listings l cross join bounds b
    where l.sold_at >= b.range_start and l.sold_at < b.range_end
    group by 1
  ),
  user_creations as (
    select date_trunc('week', u.created_at) as bucket, count(*) as count
    from auth.users u cross join bounds b
    where u.created_at >= b.range_start and u.created_at < b.range_end
    group by 1
  ),
  payment_fees as (
    select date_trunc('week', p.paid_at) as bucket,
           sum(p.amount_cents) as amount_cents
    from public.listing_payments p cross join bounds b
    where p.status = 'succeeded'
      and p.paid_at >= b.range_start and p.paid_at < b.range_end
    group by 1
  )
  select
    w.bucket::date,
    coalesce(lc.count, 0),
    coalesce(ls.count, 0),
    coalesce(uc.count, 0),
    coalesce(pf.amount_cents, 0)
  from weeks w
  left join listing_creations lc on lc.bucket = w.bucket
  left join listing_sales ls on ls.bucket = w.bucket
  left join user_creations uc on uc.bucket = w.bucket
  left join payment_fees pf on pf.bucket = w.bucket
  order by w.bucket;
end;
$$;

revoke execute on function admin_metrics_series(integer) from public;
grant execute on function admin_metrics_series(integer) to authenticated;

-- Distributions and health checks. security INVOKER, unlike the two above:
-- everything here is already visible to an admin through the admin select
-- policies, so there is no reason to widen the definer surface. The claim check
-- still runs, so a non-admin gets a clean rejection instead of a silently
-- narrowed aggregate over their own rows.
create or replace function admin_metrics_summary()
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_categories jsonb;
  v_locations jsonb;
  v_price_bands jsonb;
  v_conditions jsonb;
  v_sell_modes jsonb;
  v_median numeric;
  v_wishlisted jsonb;
  v_empty_actives bigint;
  v_payments jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Every distribution below counts the same population: listings that are or
  -- were on the market. Stored ids and raw values are returned throughout;
  -- labelling belongs to the UI, which already owns the category, condition,
  -- and sell-mode vocabularies.
  select coalesce(jsonb_agg(share order by share.count desc), '[]'::jsonb)
    into v_categories
    from (
      select coalesce(category, 'uncategorized') as category, count(*) as count
        from public.listings
       where status in ('active', 'sold')
       group by 1
    ) share;

  select coalesce(jsonb_agg(share order by share.count desc), '[]'::jsonb)
    into v_locations
    from (
      select coalesce(location, 'unspecified') as location, count(*) as count
        from public.listings
       where status in ('active', 'sold')
       group by 1
    ) share;

  -- Banded on each listing's LOWEST variant price, which is the figure a buyer
  -- sees ("From $400"). Set-only listings mirror the set total onto every
  -- variant (MEMORY 07-03), so the minimum is the set price for those and this
  -- one rule holds across all three sell modes. Empty bands are kept so the
  -- chart's x-axis does not reshuffle as inventory changes.
  with listing_min_prices as (
    select l.id as listing_id, min(s.price) as min_price
    from public.listings l
    join public.listing_sizes s on s.listing_id = l.id
    where l.status in ('active', 'sold')
    group by l.id
  ),
  bands(sort_order, band, lower_bound, upper_bound) as (
    values
      (1, 'under_100',  0::numeric,    100::numeric),
      (2, '100_249',    100::numeric,  250::numeric),
      (3, '250_499',    250::numeric,  500::numeric),
      (4, '500_999',    500::numeric,  1000::numeric),
      (5, '1000_plus',  1000::numeric, null::numeric)
  ),
  band_counts as (
    select b.sort_order, b.band, count(p.listing_id) as count
    from bands b
    left join listing_min_prices p
      on p.min_price >= b.lower_bound
     and (b.upper_bound is null or p.min_price < b.upper_bound)
    group by b.sort_order, b.band
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object('band', bc.band, 'count', bc.count)
             order by bc.sort_order
           ),
           '[]'::jsonb
         )
    into v_price_bands
    from band_counts bc;

  -- Keyed objects, not ordered arrays: both vocabularies are short and have a
  -- deliberate non-alphabetical order (condition is a quality tier) that the UI
  -- already encodes, so it looks each value up rather than trusting SQL order.
  select coalesce(jsonb_object_agg(mix.condition, mix.count), '{}'::jsonb)
    into v_conditions
    from (
      select condition, count(*) as count
        from public.listings
       where status in ('active', 'sold')
       group by 1
    ) mix;

  select coalesce(jsonb_object_agg(mix.sell_mode, mix.count), '{}'::jsonb)
    into v_sell_modes
    from (
      select sell_mode, count(*) as count
        from public.listings
       where status in ('active', 'sold')
       group by 1
    ) mix;

  select percentile_cont(0.5) within group (
           order by extract(epoch from (sold_at - created_at)) / 86400
         )
    into v_median
    from public.listings
   where sold_at is not null;

  select to_jsonb(most_saved) into v_wishlisted
    from (
      select l.id, l.title, count(w.listing_id) as saves
        from public.listings l
        join public.wishlist_items w on w.listing_id = l.id
       group by l.id, l.title, l.created_at
       order by count(w.listing_id) desc, l.created_at desc
       limit 1
    ) most_saved;

  select count(*) into v_empty_actives
    from public.listings l
   where l.status = 'active'
     and not exists (
       select 1 from public.listing_sizes s
        where s.listing_id = l.id and s.status = 'available'
     );

  select jsonb_build_object(
    'attempts',  count(*),
    'succeeded', count(*) filter (where status = 'succeeded'),
    'pending',   count(*) filter (where status = 'pending'),
    'expired',   count(*) filter (where status = 'expired')
  ) into v_payments
  from public.listing_payments;

  return jsonb_build_object(
    'category_share', v_categories,
    'location_share', v_locations,
    'price_bands', v_price_bands,
    'condition_mix', v_conditions,
    'sell_mode_mix', v_sell_modes,
    'median_time_to_sold_days',
      case when v_median is null then null else round(v_median, 1) end,
    'most_wishlisted', v_wishlisted,
    'actives_with_no_available_size', v_empty_actives,
    'payments', v_payments
  );
end;
$$;

revoke execute on function admin_metrics_summary() from public;
grant execute on function admin_metrics_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin write RPCs (moderation and image removal)
-- ---------------------------------------------------------------------------
-- None of these write an audit row. The listings trigger already derives
-- 'listing.suspend' and 'listing.restore' from the status transition, so an
-- explicit insert would produce two rows for one event. All they owe the
-- trigger is the operator's reason, which travels through app.audit_reason
-- because a set_config issued from TypeScript lands on a different PostgREST
-- connection and does nothing at all, silently.
--
-- Suspension does not cascade to variants. If suspending rewrote variant
-- statuses, restoring could not put a partially-sold listing back the way it
-- was, which is also why neither RPC sets app.audit_cascade.

create or replace function admin_suspend_listing(
  p_listing_id uuid,
  p_slug text,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
  v_count int;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_slug is null or p_slug not in (
    'spam', 'wrong-category', 'prohibited-item',
    'image-policy', 'duplicate', 'other'
  ) then
    raise exception 'Invalid suspension reason' using errcode = '22023';
  end if;

  -- The note when there is one, the slug otherwise, so
  -- listings_suspension_fields_check holds while the note stays optional. The
  -- seller-facing renderer turns a bare slug back into its own sentence, so
  -- moderator vocabulary is never shown raw.
  v_reason := coalesce(nullif(btrim(p_note), ''), p_slug);

  perform set_config('app.status_write', 'on', true);
  perform set_config('app.audit_reason', v_reason, true);

  -- previous_status reads the pre-update value, which is what makes restore
  -- exact in every case, including the two that matter most: a suspended
  -- pending_payment listing restored to 'active' would be a free publish, and
  -- one suspended out of 'sold' would un-sell a gown.
  update public.listings
     set status = 'suspended',
         suspension_slug = p_slug,
         suspension_reason = v_reason,
         previous_status = status,
         suspended_at = now()
   where id = p_listing_id
     and status <> 'suspended';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  -- One-shot, like app.audit_cascade: cleared right after the triggering
  -- statement, or a later write in the same transaction inherits a moderation
  -- note that was never about it. app.status_write closes for the same reason,
  -- and a leaked capability is worse than a leaked note: it hands the next
  -- statement in the transaction the right to write status directly.
  perform set_config('app.status_write', '', true);
  perform set_config('app.audit_reason', '', true);
end;
$$;

revoke execute on function admin_suspend_listing(uuid, text, text) from public;
grant execute on function admin_suspend_listing(uuid, text, text) to authenticated;

-- Restores out of either 'suspended' or 'removed' (migration 034 widened this
-- from suspended-only, to admit remove_listing()'s own widening beside it).
-- Suspended still restores to the exact previous_status it was suspended out
-- of (unchanged). Removed restores to 'active' only if previous_status says
-- the listing had already gone live (active or sold) before removal; a
-- listing removed while still pending_payment -- or one removed before
-- migration 034 existed, so it carries no previous_status at all -- restores
-- to pending_payment instead. That is the SAFE side of the ambiguity: a
-- listing that never crossed the fee gate must never come back active for
-- free, and restoring to anything but exactly 'active' or 'pending_payment'
-- makes no sense the way restoring a suspension to its exact prior status
-- does -- there is no reason to bring a removed-then-sold listing back as
-- 'sold' rather than onto the market. This is what makes an admin able to
-- restore ANY removed listing, including one a seller removed themselves
-- through their own RemoveListingButton (which already reaches a
-- pending_payment listing -- nothing gates that today), without ever
-- bypassing an unpaid fee.
create or replace function admin_restore_listing(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  perform set_config('app.status_write', 'on', true);

  -- All four columns clear together so listings_suspension_fields_check holds.
  -- sold_at is deliberately untouched: neither suspend nor remove clears it, so
  -- a listing routed out of 'sold' restores with its sale date intact.
  update public.listings
     set status = case
           when status = 'suspended' then previous_status
           when previous_status in ('active', 'sold') then 'active'
           else 'pending_payment'
         end,
         previous_status = null,
         suspension_slug = null,
         suspension_reason = null,
         suspended_at = null
   where id = p_listing_id
     and status in ('suspended', 'removed');

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  perform set_config('app.status_write', '', true);
end;
$$;

revoke execute on function admin_restore_listing(uuid) from public;
grant execute on function admin_restore_listing(uuid) to authenticated;

-- Ban's companion sweep. One statement, so it is atomic within the database,
-- and one audit row per listing from the trigger. It RETURNS the ids it
-- suspended because the server action needs them to invalidate each cached
-- detail page, and collecting them afterwards would find nothing: the rows are
-- no longer active by then.
create or replace function admin_suspend_seller_listings(
  p_user_id uuid,
  p_slug text,
  p_note text default null
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason text;
  v_ids uuid[];
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_slug is null or p_slug not in (
    'spam', 'wrong-category', 'prohibited-item',
    'image-policy', 'duplicate', 'other'
  ) then
    raise exception 'Invalid suspension reason' using errcode = '22023';
  end if;

  v_reason := coalesce(nullif(btrim(p_note), ''), p_slug);

  perform set_config('app.status_write', 'on', true);
  perform set_config('app.audit_reason', v_reason, true);

  with swept as (
    update public.listings
       set status = 'suspended',
           suspension_slug = p_slug,
           suspension_reason = v_reason,
           previous_status = status,
           suspended_at = now()
     where user_id = p_user_id
       and status = 'active'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from swept;

  perform set_config('app.status_write', '', true);
  perform set_config('app.audit_reason', '', true);

  return v_ids;
end;
$$;

revoke execute on function admin_suspend_seller_listings(uuid, text, text) from public;
grant execute on function admin_suspend_seller_listings(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo moderation: remove, replace, append, move
-- ---------------------------------------------------------------------------

-- Each one takes the URL (or, for a move, the index plus the URL expected to be
-- there) and does the array surgery here rather than accepting pre-computed
-- arrays, so a replayed request cannot rewrite a listing's photos into anything
-- it likes. The index is found in the listing's own stored array or the call
-- fails, and the blur entry at that same index goes with it or
-- listings_image_arrays_check rejects the write.
--
-- Each returns the COMMITTED array. The action deletes the old storage object
-- only when the returned array no longer contains that URL: the constraint
-- bounds count and parity but not uniqueness, so a listing carrying the same
-- URL twice would otherwise have one index rewritten while the other still
-- pointed at the object being deleted.
--
-- Why RPCs rather than plain UPDATEs from the action: supabase-js can only send
-- literal values, so a client-side edit means reading the arrays, running the
-- pipeline (download + Vision + sharp + upload, seconds), and writing back an
-- array computed from a snapshot that is now stale. Migration 033 documents
-- exactly what that costs. Here every write is one statement against the row's
-- own current value, and the audit slug override has to run in this transaction
-- anyway (audit_listing_change() otherwise files it as 'listing.edit').
create or replace function admin_remove_listing_image(
  p_listing_id uuid,
  p_image_url text
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_urls text[];
  v_blurs text[];
  v_index int;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Locked, not a plain read: two operators removing different photos from the
  -- same listing would otherwise both compute their arrays from the same
  -- pre-transaction snapshot, and the second write would resurrect the URL the
  -- first one removed after its storage object was already deleted. The second
  -- transaction blocks here and re-reads the committed array instead.
  select l.image_urls, l.image_blur_data_urls
    into v_urls, v_blurs
    from public.listings l
   where l.id = p_listing_id
     for update;

  if v_urls is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  v_index := array_position(v_urls, p_image_url);
  if v_index is null then
    raise exception 'Image not found' using errcode = 'P0002';
  end if;

  if cardinality(v_urls) <= 1 then
    raise exception 'A listing must keep at least one photo'
      using errcode = '23514';
  end if;

  perform set_config('app.audit_action', 'listing.image_remove', true);

  update public.listings
     set image_urls = v_urls[1:v_index - 1] || v_urls[v_index + 1:],
         image_blur_data_urls =
           v_blurs[1:v_index - 1] || v_blurs[v_index + 1:]
   where id = p_listing_id
  returning image_urls into v_urls;

  -- One-shot, same rule as app.audit_reason and app.audit_variants.
  perform set_config('app.audit_action', '', true);

  return v_urls;
end;
$$;

revoke execute on function admin_remove_listing_image(uuid, text) from public;
grant execute on function admin_remove_listing_image(uuid, text) to authenticated;

-- Swaps one stored image URL (and its blur placeholder) for a freshly processed
-- one, in place, without disturbing the other photos. Serves both the reprocess
-- action (the same photo, re-run through the pipeline) and the replace action
-- (a different photo the seller sent in), which is why the audit slug is a
-- parameter: those are not the same event and the log has to tell them apart.
--
-- The DEFAULT keeps any caller that sends only four named arguments working,
-- since PostgREST resolves an RPC by argument NAMES.
--
-- The slug is bounded, not proven: a client-supplied value narrowed to two
-- admin-only outcomes, which is an admin's stated intent rather than an
-- unforgeable account of what happened. The null branch is not decoration --
-- SQL `not in` yields NULL for a NULL left operand, so a bare check would let a
-- null through, set_config would blank the GUC, and the trigger would quietly
-- file the event as 'listing.edit'.
--
-- The object written by both paths is owned by the ADMIN. Under
-- `admin/<listing_id>/` the seller can still delete it through the storage
-- policy above; objects written before migration 036 have flat paths and stay
-- with the orphan sweep.
create or replace function admin_replace_listing_image(
  p_listing_id uuid,
  p_old_url text,
  p_new_url text,
  p_new_blur text,
  p_audit_action text default 'listing.image_reprocess'
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_urls text[];
  v_index int;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_audit_action is null
     or p_audit_action not in ('listing.image_reprocess', 'listing.image_replace')
  then
    raise exception 'Invalid audit action' using errcode = '22023';
  end if;

  -- Locked for the same reason as admin_remove_listing_image: two operators
  -- acting on the same listing would otherwise both compute from the same
  -- pre-transaction snapshot and the second write would undo the first.
  select l.image_urls
    into v_urls
    from public.listings l
   where l.id = p_listing_id
     for update;

  if v_urls is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  v_index := array_position(v_urls, p_old_url);
  if v_index is null then
    raise exception 'Image not found' using errcode = 'P0002';
  end if;

  -- Cardinality does not move, so the listings_image_arrays_check constraint
  -- cannot be broken here and there is no minimum-photo guard to repeat.
  perform set_config('app.audit_action', p_audit_action, true);

  update public.listings
     set image_urls[v_index] = p_new_url,
         -- coalesce: the server-side placeholder generator can come back empty,
         -- and the seller path stores '' rather than null in that case.
         image_blur_data_urls[v_index] = coalesce(p_new_blur, '')
   where id = p_listing_id
  returning image_urls into v_urls;

  perform set_config('app.audit_action', '', true);

  return v_urls;
end;
$$;

revoke execute on function admin_replace_listing_image(uuid, text, text, text, text)
  from public;
grant execute on function admin_replace_listing_image(uuid, text, text, text, text)
  to authenticated;

-- Appends a photo an admin received out of band. The inverse of removal, and
-- the same shape.
create or replace function admin_append_listing_image(
  p_listing_id uuid,
  p_new_url text,
  p_new_blur text
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_urls text[];
  v_blurs text[];
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- The lock is load-bearing in a way it is not for a positional swap: two
  -- operators adding at once would both read cardinality 2, both append, and
  -- the loser's write would drop the winner's URL.
  select l.image_urls, l.image_blur_data_urls
    into v_urls, v_blurs
    from public.listings l
   where l.id = p_listing_id
     for update;

  if v_urls is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  -- Explicit rather than leaning on listings_image_arrays_check, mirroring how
  -- removal raises its own minimum, so the action can map the code to operator
  -- copy instead of surfacing a raw constraint violation.
  if cardinality(v_urls) >= 3 then
    raise exception 'A listing can hold at most three photos'
      using errcode = '23514';
  end if;

  perform set_config('app.audit_action', 'listing.image_add', true);

  update public.listings
     set image_urls = v_urls || p_new_url,
         image_blur_data_urls = v_blurs || coalesce(p_new_blur, '')
   where id = p_listing_id
  returning image_urls into v_urls;

  perform set_config('app.audit_action', '', true);

  return v_urls;
end;
$$;

revoke execute on function admin_append_listing_image(uuid, text, text) from public;
grant execute on function admin_append_listing_image(uuid, text, text) to authenticated;

-- Moves one photo one position. Photo 1 is the listing's cover image, so this
-- is a real capability rather than a nicety.
--
-- Deliberately a DIRECTION, not a whole reordered array. Taking an array from
-- the client means validating it is a permutation of the stored one, and means
-- the client computed it from a read that is already stale. A direction sends
-- no array at all and swaps against the row's own locked value.
--
-- Addressed by INDEX plus expected URL, unlike the other three photo RPCs.
-- Duplicate URLs in one array are reachable (image_urls is seller-writable
-- through update_listing_with_variants), and array_position would then move the
-- FIRST occurrence rather than the thumbnail that was clicked. Worse, swapping
-- two identical adjacent entries leaves image_digest unchanged, so the audit
-- trigger emits no row and the action appears to do nothing. Remove, reprocess
-- and replace keep URL addressing because acting on either of two byte-
-- identical entries is indistinguishable from acting on the right one;
-- position is the whole point here.
create or replace function admin_move_listing_image(
  p_listing_id uuid,
  p_index int,
  p_expected_url text,
  p_offset int
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_urls text[];
  v_blurs text[];
  v_target int;
  v_url text;
  v_blur text;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_offset is null or p_offset not in (-1, 1) then
    raise exception 'Invalid move' using errcode = '22023';
  end if;

  select l.image_urls, l.image_blur_data_urls
    into v_urls, v_blurs
    from public.listings l
   where l.id = p_listing_id
     for update;

  if v_urls is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  if p_index is null or p_index < 1 or p_index > cardinality(v_urls) then
    raise exception 'That position is not on this listing' using errcode = '22023';
  end if;

  -- The photos changed under the operator: their page is stale, and moving
  -- whatever now sits at that index would move the wrong photo.
  if v_urls[p_index] is distinct from p_expected_url then
    raise exception 'Image not found' using errcode = 'P0002';
  end if;

  v_target := p_index + p_offset;
  if v_target < 1 or v_target > cardinality(v_urls) then
    raise exception 'That photo is already at the end' using errcode = '22023';
  end if;

  -- Refused rather than treated as a silent no-op: swapping two byte-identical
  -- entries leaves image_digest unchanged, so the audit trigger writes nothing
  -- and the operator would be told a move happened that no record can show.
  if v_urls[p_index] = v_urls[v_target] then
    raise exception 'Those two photos are identical' using errcode = '22023';
  end if;

  v_url := v_urls[p_index];
  v_blur := v_blurs[p_index];
  v_urls[p_index] := v_urls[v_target];
  v_blurs[p_index] := v_blurs[v_target];
  v_urls[v_target] := v_url;
  v_blurs[v_target] := v_blur;

  perform set_config('app.audit_action', 'listing.image_reorder', true);

  update public.listings
     set image_urls = v_urls,
         image_blur_data_urls = v_blurs
   where id = p_listing_id
  returning image_urls into v_urls;

  perform set_config('app.audit_action', '', true);

  return v_urls;
end;
$$;

revoke execute on function admin_move_listing_image(uuid, int, text, int) from public;
grant execute on function admin_move_listing_image(uuid, int, text, int) to authenticated;
