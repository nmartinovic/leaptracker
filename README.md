# LeapTracker

A personal options performance tracker. Track LEAPS and other options contracts over time, with daily price snapshots benchmarked against SPY.

**Live app:** https://leaptracker.vercel.app

## Features

- Add options by pasting a Yahoo Finance URL or OCC symbol
- Daily price snapshots captured automatically at 3:30 PM ET (during market hours)
- Dashboard with sortable/filterable table: option %, SPY %, and alpha since entry
- Detail view with dual-line performance chart (option vs SPY indexed to entry)
- Portfolio simulation: group options with quantities and see aggregate value vs SPY

## Stack

- **Next.js 16** (App Router, TypeScript) on Vercel
- **Supabase** (PostgreSQL)
- **Recharts** for charts
- **yahoo-finance2** for daily price data (no API key required)
- **Vercel Cron** + GitHub Actions fallback for daily price fetching

## Local Development

Requires Node 20+.

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local

# Apply the database schema in Supabase SQL editor:
# supabase/migrations/0001_initial_schema.sql

# Start the dev server
npm run dev
```

Open http://localhost:3000.

```bash
npm run test      # Run tests
npm run build     # Production build + type check
```

## Manually trigger a price fetch

```bash
curl -X POST https://leaptracker.vercel.app/api/cron/fetch-prices \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (server-only) |
| `CRON_SECRET` | Random string protecting the cron endpoint |
