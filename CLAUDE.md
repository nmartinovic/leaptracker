# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeapTracker is a Next.js options performance tracking web application. It tracks LEAPS and other options contracts daily, benchmarked against SPY. Full spec in `prd.md`.

## Tech Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript), deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Charts:** Recharts
- **Price Data:** `yahoo-finance2` npm package (unofficial, no API key required)
- **Cron:** Vercel Cron (`vercel.json`) as primary + GitHub Actions (`.github/workflows/daily-fetch.yml`) as fallback — both run 22:15 UTC weekdays
- **Node.js:** Must use v20+ (`nvm use 20` if needed)

## Commands

```bash
npm run dev       # Start development server (requires .env.local to be filled in)
npm run build     # Production build + TypeScript check
npm run lint      # Run ESLint
npm run test      # Run tests (vitest)
npm run test:watch
```

## Project Structure

```
src/
  lib/               # All business logic (no UI)
    supabase.ts      # createAdminClient() — server-only; supabase — browser client
    database.types.ts  # Hand-written type stub; regenerate with `npx supabase gen types`
    parseOptionSymbol.ts  # OCC symbol parser (pure, fully tested)
    fetchOptionPrice.ts   # yahoo-finance2 wrapper with retry + $0 guard
    cronFetchPrices.ts    # Daily cron business logic
    computePortfolioTimeSeries.ts
    formatters.ts    # formatContractName, formatPrice, formatPercent, pctChange, daysToExpiration
    marketHolidays.ts    # isTradingDay() — update annually
  app/
    page.tsx                     # Dashboard (server component)
    options/[id]/page.tsx        # Option detail view
    portfolios/page.tsx          # Portfolio list
    portfolios/[id]/page.tsx     # Portfolio detail
    api/options/route.ts         # GET + POST /api/options
    api/options/[id]/route.ts    # GET + PATCH + DELETE
    api/portfolios/route.ts
    api/portfolios/[id]/route.ts
    api/portfolios/[id]/holdings/route.ts
    api/cron/fetch-prices/route.ts  # Protected by CRON_SECRET header
  components/
    DashboardClient.tsx    # Client wrapper for dashboard (filter/sort/modal state)
    AddOptionForm.tsx      # Form: Yahoo URL + entry price + tags
    AddHoldingForm.tsx
    AddHoldingModal.tsx
    CreatePortfolioButton.tsx
    ui/                    # Badge, PercentChange, Modal, EmptyState, LoadingSpinner, SortableTable
    charts/                # PerformanceChart (indexed/raw toggle), PortfolioChart
  tests/__tests__/         # parseOptionSymbol + formatters tests (20 tests)
supabase/migrations/0001_initial_schema.sql  # Run this in Supabase SQL editor to create schema
```

## Architecture

### Data Model (4 tables)
- `tracked_options` — contracts with metadata; `is_active=false` after expiration
- `price_history` — daily bid/ask/midpoint + SPY close; `unique(option_id, date)` makes cron re-runs safe
- `portfolios` / `portfolio_holdings` — virtual portfolio grouping with quantity/cost_basis

### Key Patterns
- **Server components** do DB queries directly via `createAdminClient()`. Client components use `fetch('/api/...')`.
- **`createAdminClient()`** returns `any` until you regenerate `database.types.ts` from Supabase — add explicit type casts when calling it.
- **Yahoo Finance Symbol (OCC format):** `{TICKER}{YYMMDD}{C|P}{PRICE_IN_THOUSANDTHS}` — always prepend `20` to year. Regex: `/([A-Z]{1,6})(\d{6})([CP])(\d{8})/`
- **Cron**: skips non-trading days via `isTradingDay()`, skips options with bid=0 or ask=0, upserts on `(option_id, date)`.
- **Portfolio value**: `quantity × midpoint × 100` per holding (options represent 100 shares)

### API Routes
- `POST /api/options` — `{ url, entry_price, tags[] }` — parses OCC symbol, fetches initial price
- `GET /api/options?tag=foo` — returns options with computed `option_pct_change`, `spy_pct_change`, `alpha`
- `PATCH /api/options/:id` — only allows updating `tags` and `is_active`
- `POST /api/cron/fetch-prices` — requires `Authorization: Bearer <CRON_SECRET>` header

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase project Settings > API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase project Settings > API
SUPABASE_SERVICE_ROLE_KEY=       # server-only; never expose to browser
CRON_SECRET=                     # any random string; must match Vercel + GitHub Actions secrets
```

## Deployment

- **Production:** https://leaptracker.vercel.app
- **Supabase project:** `hfncowvbjoaknpouivzm` (region: us-east-1)
- **GitHub repo:** https://github.com/nmartinovic/leaptracker
- Vercel is connected to the GitHub repo — pushing to `main` triggers a redeploy automatically
- Vercel Cron runs `/api/cron/fetch-prices` at 22:15 UTC (10:15 PM ET) weekdays
- GitHub Actions `.github/workflows/daily-fetch.yml` is a fallback cron — requires `CRON_SECRET` and `VERCEL_DOMAIN` secrets set in the repo

## Supabase Setup

- Schema is already applied to the production Supabase project
- To apply to a new project: run `supabase/migrations/0001_initial_schema.sql` in the SQL editor
- Regenerate types after any schema change: `npx supabase gen types typescript --project-id hfncowvbjoaknpouivzm > src/lib/database.types.ts`
  - After regenerating, remove the `as any` cast in `createAdminClient()` in `src/lib/supabase.ts`

## Known Gotchas

- **Node.js version:** Must use v20+ locally (`nvm use 20`). Vercel is configured to use Node 22 via `engines` in `package.json` — required by `yahoo-finance2` v3.
- **`yahoo-finance2` v3 API change:** v3 requires instantiation — `new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] })`. The old v2 default-export call pattern silently fails. See `src/lib/fetchOptionPrice.ts`.
- **LEAPS bid/ask are often $0:** After market close and early in the trading day, lightly traded LEAPS frequently have `bid=0, ask=0`. The cron runs at 19:30 UTC (3:30 PM ET, during market hours) to maximise the chance of real quotes. When bid/ask are still both $0, the code falls back to `regularMarketPrice` (last traded price) rather than skipping entirely.
- **`createAdminClient()` returns `any`** because `database.types.ts` is a hand-written stub. All query results need explicit type casts (e.g. `const option = data as TrackedOption`). This goes away once you regenerate types from Supabase.
- **Not all OCC symbols exist on Yahoo Finance.** A symbol can parse correctly but return `undefined` from Yahoo (e.g. non-existent contracts). The fetch returns `null` and no price row is written — this is expected.
- **Supabase UI labels:** The API keys section is "API Keys" (not "API"), with "publishable key" (= anon key) and "secret key" (= service_role key). Project URL is under Settings → General.
- **`create-next-app` won't run in a non-empty directory** — scaffold in a temp dir and rsync files over if needed.
- **Recharts `Tooltip` formatter** must accept `(value: ValueType, name: NameType)` — typing as `(value: number, name: string)` causes a TypeScript build error.
