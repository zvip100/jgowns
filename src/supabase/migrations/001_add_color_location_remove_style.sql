-- Migration: Replace style with color + location, tighten condition constraint
-- Run this against your existing Supabase database.

-- 1. Add new columns
alter table listings
  add column if not exists color    text,
  add column if not exists location text;

-- 2. Drop the style column (no longer used)
alter table listings drop column if exists style;

-- 3. Migrate existing condition values to the new three-value set
update listings set condition = 'Brand New'          where condition = 'Brand new';
update listings set condition = 'Perfect Condition'  where condition in ('Like new', 'Gently Worn');
update listings set condition = 'Needs Alterations'  where condition = 'Needs alterations';
-- Catch-all: any remaining unrecognised value defaults to 'Perfect Condition'
update listings
  set condition = 'Perfect Condition'
  where condition not in ('Brand New', 'Perfect Condition', 'Needs Alterations');

-- 4. Add check constraint for the new condition values
--    (drop any existing constraint first if it exists)
alter table listings
  drop constraint if exists listings_condition_check;
alter table listings
  add constraint listings_condition_check
  check (condition in ('Brand New', 'Perfect Condition', 'Needs Alterations'));

-- 5. Partial indexes for active-listing filter queries (Supabase best practice)
create index if not exists listings_size_active_idx      on listings(size)           where status = 'active';
create index if not exists listings_color_active_idx     on listings(color)          where status = 'active';
create index if not exists listings_location_active_idx  on listings(location)       where status = 'active';
create index if not exists listings_condition_active_idx on listings(condition)      where status = 'active';
create index if not exists listings_price_active_idx     on listings(price)          where status = 'active';
create index if not exists listings_created_active_idx   on listings(created_at desc) where status = 'active';
