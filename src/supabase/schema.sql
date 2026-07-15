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
  status text default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamp with time zone default now(),
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

create table payment_intents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  amount numeric(10,2),
  currency text default 'usd',
  status text default 'pending',
  stripe_payment_intent_id text,
  created_at timestamp with time zone default now()
);

-- Contact form submissions. Write-only from the app: insert is granted to anon
-- + authenticated (buyers have no accounts), with no select/update/delete
-- policies — messages are readable only via the Supabase dashboard (and a later
-- admin inbox).
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  created_at timestamp with time zone not null default now()
);

insert into storage.buckets (id, name, public) values ('gown-images', 'gown-images', true);

alter table listings enable row level security;

create policy "Public can view active listings" on listings for select using (status = 'active');
create policy "Sellers can view own listings" on listings for select using (auth.uid() = user_id);
create policy "Sellers can insert listings" on listings for insert with check (auth.uid() = user_id);
create policy "Sellers can update own listings" on listings for update using (auth.uid() = user_id);
create policy "Sellers can delete own listings" on listings for delete using (auth.uid() = user_id);

alter table listing_sizes enable row level security;

create policy "Public can view sizes of active listings" on listing_sizes
  for select using (
    exists (
      select 1 from listings l
      where l.id = listing_id and l.status = 'active'
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

alter table contact_messages enable row level security;

create policy "Anyone can submit a contact message" on contact_messages
  for insert
  to anon, authenticated
  with check (true);

create policy "Public image access" on storage.objects for select using (bucket_id = 'gown-images');
create policy "Auth users can upload images" on storage.objects for insert with check (bucket_id = 'gown-images' and auth.role() = 'authenticated');
create policy "Users can delete own images" on storage.objects for delete using (bucket_id = 'gown-images' and auth.uid() = owner);

-- Atomic "mark listing sold": flip the listing status and all of its size
-- variants in one transaction, so a mid-way failure can't leave the listing
-- sold while some variants stay available.
create or replace function mark_listing_sold(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.listings
     set status = 'sold'
   where id = p_listing_id and user_id = v_uid;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  update public.listing_sizes
     set status = 'sold'
   where listing_id = p_listing_id;
end;
$$;

grant execute on function mark_listing_sold(uuid) to authenticated;

-- Atomic "reactivate listing": flip the listing status back to active and all
-- of its size variants back to available in one transaction, undoing a
-- mark-sold so a mid-way failure can't leave the listing active while some
-- variants stay sold.
create or replace function reactivate_listing(p_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.listings
     set status = 'active'
   where id = p_listing_id and user_id = v_uid;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  update public.listing_sizes
     set status = 'available'
   where listing_id = p_listing_id;
end;
$$;

grant execute on function reactivate_listing(uuid) to authenticated;

-- Atomic "mark size sold" with listing-status sync: mark one variant sold and,
-- if it was the last available variant, flip the parent listing to 'sold' in the
-- same transaction. Keeps listings.status consistent with its variants so a
-- listing sold off one size at a time disappears from browse exactly like one
-- sold via mark_listing_sold. Ownership is enforced by RLS on listing_sizes
-- (via parent) for the size update, and by the explicit user_id guard on the
-- listing update.
create or replace function mark_size_sold(p_listing_id uuid, p_size_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
  v_available int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.listing_sizes
     set status = 'sold'
   where id = p_size_id and listing_id = p_listing_id;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Size not found' using errcode = 'P0002';
  end if;

  select count(*) into v_available
    from public.listing_sizes
   where listing_id = p_listing_id and status = 'available';

  if v_available = 0 then
    update public.listings
       set status = 'sold'
     where id = p_listing_id and user_id = v_uid;
  end if;
end;
$$;

grant execute on function mark_size_sold(uuid, uuid) to authenticated;

-- Atomic listing edit: update the shared listing row and reconcile its size
-- variants (delete removed, re-price/re-order kept ones while preserving their
-- status, insert new ones) in a single transaction. Image upload and cleanup
-- stay in the server action because storage writes can't participate in the
-- database transaction.
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
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select user_id into v_owner from public.listings where id = p_listing_id;

  if v_owner is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid then
    raise exception 'Not authorized' using errcode = '42501';
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
    image_urls           = array(select jsonb_array_elements_text(p_listing->'image_urls')),
    image_blur_data_urls = array(select jsonb_array_elements_text(p_listing->'image_blur_data_urls')),
    contact_email        = p_listing->>'contact_email',
    contact_phone        = p_listing->>'contact_phone',
    contact_methods      = array(select jsonb_array_elements_text(p_listing->'contact_methods'))
  where id = p_listing_id;

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
end;
$$;

grant execute on function update_listing_with_variants(uuid, jsonb, jsonb) to authenticated;
