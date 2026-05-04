import { createClient } from '@supabase/supabase-js';

// Cookieless anon client for public (unauthenticated) server-side queries.
// Safe to use inside 'use cache' scopes since it reads no dynamic data sources.
export const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
