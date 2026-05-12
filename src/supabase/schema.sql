create extension if not exists "uuid-ossp";

create table listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  size text not null,
  color text,
  location text,
  category text check (
    category is null
    or category in (
      'bride',
      'mother-of-the-bride',
      'girls',
      'women',
      'maternity'
    )
  ),
  condition text not null check (condition in ('Brand New', 'Perfect Condition', 'Needs Alterations')),
  price numeric(10,2) not null,
  image_url text not null,
  image_blur_data_url text,
  contact_email text not null,
  contact_phone text,
  status text default 'active' check (status in ('active', 'sold', 'draft')),
  created_at timestamp with time zone default now()
);

-- Partial indexes covering only active listings for fast filter queries
create index listings_size_active_idx      on listings(size)      where status = 'active';
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
