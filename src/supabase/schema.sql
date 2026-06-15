create extension if not exists "uuid-ossp";

create table listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  size text not null,
  size_group text not null,
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
  price numeric(10,2) not null,
  image_urls text[] not null default '{}',
  image_blur_data_urls text[] not null default '{}',
  contact_email text not null,
  contact_phone text,
  status text default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamp with time zone default now(),
  constraint listings_image_arrays_check check (
    cardinality(image_urls) between 1 and 3
    and cardinality(image_blur_data_urls) = cardinality(image_urls)
  ),
  constraint listings_size_pair_check check (
    (size_group = 'toddler' and size in ('2T','3T','4T','5T','6T','7T','8T','9T','10T')) or
    (size_group = 'kids'    and size in ('3','5','6','7','8','10','12','14','16')) or
    (size_group = 'junior'  and size in ('J6','J8','J10','J12','J14','J16','J18')) or
    (size_group = 'adult'   and size in ('0','2','4','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36'))
  )
);

-- Partial indexes covering only active listings for fast filter queries
create index listings_size_group_size_active_idx on listings(size_group, size) where status = 'active';
create index listings_color_active_idx     on listings(color)     where status = 'active';
create index listings_location_active_idx  on listings(location)  where status = 'active';
create index listings_category_active_idx  on listings(category)   where status = 'active';
create index listings_condition_active_idx on listings(condition) where status = 'active';
create index listings_price_active_idx     on listings(price)     where status = 'active';
create index listings_created_active_idx   on listings(created_at desc) where status = 'active';

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

insert into storage.buckets (id, name, public) values ('gown-images', 'gown-images', true);

alter table listings enable row level security;

create policy "Public can view active listings" on listings for select using (status = 'active');
create policy "Sellers can view own listings" on listings for select using (auth.uid() = user_id);
create policy "Sellers can insert listings" on listings for insert with check (auth.uid() = user_id);
create policy "Sellers can update own listings" on listings for update using (auth.uid() = user_id);
create policy "Sellers can delete own listings" on listings for delete using (auth.uid() = user_id);

create policy "Public image access" on storage.objects for select using (bucket_id = 'gown-images');
create policy "Auth users can upload images" on storage.objects for insert with check (bucket_id = 'gown-images' and auth.role() = 'authenticated');
create policy "Users can delete own images" on storage.objects for delete using (bucket_id = 'gown-images' and auth.uid() = owner);
