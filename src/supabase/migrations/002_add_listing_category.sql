-- Listing category for /browse?category=… (bride, bridesmaid, maternity, etc.)
-- Run once against your Supabase project after 001. Safe to re-run: IF NOT EXISTS / IF EXISTS guards.

alter table listings
  add column if not exists category text;

alter table listings
  drop constraint if exists listings_category_check;

alter table listings
  add constraint listings_category_check
  check (
    category is null
    or category in (
      'bride',
      'mother-of-the-bride',
      'bridesmaid',
      'girls',
      'women',
      'maternity'
    )
  );

create index if not exists listings_category_active_idx
  on listings(category)
  where status = 'active';
