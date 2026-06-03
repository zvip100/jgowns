# JGowns

A marketplace for pre-loved modest gowns. Sellers list their gowns with photos, sizing, and contact details; buyers browse and reach out directly.

## Features

- **Browse listings** — filter by category, size, color, location, condition, and price range
- **Seller dashboard** — create, edit, and mark listings as sold
- **Image pipeline** — server-side face detection (Google Vision API), face blurring, cropping, and WebP conversion via Sharp
- **Auth** — email/password sign up and sign in via Supabase
- **Categories** — Bridal, Mother of the Bride, Women, Girls, Maternity

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (v16+) |
| Auth / DB / Storage | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) |
| Image processing | Google Vision API + Sharp |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Icons | lucide-react |

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the environment variables file and fill in your keys:

```bash
cp .env.example .env.local
```

Required environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLOUD_VISION_API_KEY=
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    (auth)/           # Login and register pages
    (main)/
      page.tsx        # Homepage / hero
      browse/         # Listing browse + detail pages
      dashboard/      # Seller dashboard, new listing, edit listing
  components/
    form/             # Reusable form field components
    ui/               # shadcn/ui primitives (do not edit directly)
    *.tsx             # Feature components (GownCard, FilterBar, Navbar, …)
  lib/
    actions/          # Server actions (auth, sell, listings, images)
    queries/          # Read-only server-side data fetchers
    supabase/         # Supabase client helpers (server + client)
    *.ts              # Utilities (browse filters, pagination, gown sizes, types)
  supabase/
    schema.sql        # Full database schema
    migrations/       # Incremental SQL migrations
```
