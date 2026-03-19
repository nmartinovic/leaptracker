# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeapTracker is a Next.js options performance tracking web application. It tracks LEAPS and other options contracts daily, benchmarked against SPY. Full spec in `prd.md`.

## Tech Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript), deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Charts:** Recharts
- **Price Data:** `yahoo-finance2` npm package (unofficial, no API key required)
- **Cron:** Vercel Cron (`vercel.json`) as primary + GitHub Actions (`.github/workflows/daily-fetch.yml`) as fallback — both run 19:30 UTC (3:30 PM ET) weekdays
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
    fetchOptionPrice.ts   # yahoo-finance2 wrapper with retry + $0 guard; exports fetchStockPrice()
    findLeapOption.ts     # Auto-selects a LEAPS call (>=540 days, ATM strike) for a given ticker
    cronFetchPrices.ts    # Daily cron business logic; backfills entry_price when entry_price_pending=true
    computePortfolioTimeSeries.ts
    formatters.ts    # formatContractName, formatPrice, formatPercent, pctChange, daysToExpiration
    marketHolidays.ts    # isTradingDay() — update annually
  app/
    page.tsx                     # Dashboard (server component) — fetches live stock prices per ticker
    options/[id]/page.tsx        # Option detail view — shows stock price + vs-strike %
    portfolios/page.tsx          # Portfolio list
    portfolios/[id]/page.tsx     # Portfolio detail
    api/options/route.ts         # GET + POST /api/options
    api/options/[id]/route.ts    # GET + PATCH + DELETE
    api/options/auto/route.ts    # POST /api/options/auto — auto-add a LEAPS call by ticker symbol
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
supabase/migrations/
  0001_initial_schema.sql       # Core schema
  0002_entry_price_pending.sql  # Adds entry_price_pending boolean to tracked_options
  0003_enable_rls.sql           # Enables RLS on all public tables
```

## Architecture

### Data Model (4 tables)
- `tracked_options` — contracts with metadata; `is_active=false` after expiration; `entry_price_pending=true` when entry price was captured outside market hours and needs backfilling
- `price_history` — daily bid/ask/midpoint + SPY close; `unique(option_id, date)` makes cron re-runs safe
- `portfolios` / `portfolio_holdings` — virtual portfolio grouping with quantity/cost_basis

### Key Patterns
- **Server components** do DB queries directly via `createAdminClient()`. Client components use `fetch('/api/...')`.
- **`createAdminClient()`** returns `any` until you regenerate `database.types.ts` from Supabase — add explicit type casts when calling it.
- **Yahoo Finance Symbol (OCC format):** `{TICKER}{YYMMDD}{C|P}{PRICE_IN_THOUSANDTHS}` — always prepend `20` to year. Regex: `/([A-Z]{1,6})(\d{6})([CP])(\d{8})/`
- **Cron**: skips non-trading days via `isTradingDay()`, skips options with bid=0 or ask=0, upserts on `(option_id, date)`. Also backfills `entry_price` for any option where `entry_price_pending=true`.
- **Portfolio value**: `quantity × midpoint × 100` per holding (options represent 100 shares)
- **RLS**: Enabled on all tables. No policies needed — all access is via `service_role` key which bypasses RLS. Anon key is blocked from direct table access.

### API Routes
- `POST /api/options` — `{ url, entry_price, tags[] }` — parses OCC symbol, fetches initial price
- `GET /api/options?tag=foo` — returns options with computed `option_pct_change`, `spy_pct_change`, `alpha`
- `PATCH /api/options/:id` — only allows updating `tags` and `is_active`
- `POST /api/cron/fetch-prices` — requires `Authorization: Bearer <CRON_SECRET>` header
- `POST /api/options/auto` — `{ symbol: "AAPL" }` — auto-selects and tracks a LEAPS call option

### Auto-Add Flow (`POST /api/options/auto`)
1. Fetches current stock price via `yf.quote(ticker)`
2. Gets available option expiration dates via `yf.options(ticker)`
3. Filters to expirations ≥ 540 days from today, picks the nearest qualifying one
4. Fetches the call option chain for that expiration
5. Finds the call with strike closest to current stock price (ATM)
6. Sets `entry_price = (bid + ask) / 2`, tags as `#auto`
7. If market is closed (bid=ask=0, fell back to last-traded price), sets `entry_price_pending=true`
8. Cron backfills `entry_price` with the first live midpoint and clears the flag

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase project Settings > General
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase project Settings > API Keys (publishable key)
SUPABASE_SERVICE_ROLE_KEY=       # server-only; never expose to browser (secret key)
CRON_SECRET=                     # any random string; must match Vercel + GitHub Actions secrets
```

## Deployment

- **Production:** https://leaptracker.vercel.app
- **Supabase project:** `hfncowvbjoaknpouivzm` (region: us-east-1)
- **GitHub repo:** https://github.com/nmartinovic/leaptracker
- Vercel is connected to the GitHub repo — pushing to `main` triggers a redeploy automatically
- Vercel Cron runs `/api/cron/fetch-prices` at 19:30 UTC (3:30 PM ET) weekdays
- GitHub Actions `.github/workflows/daily-fetch.yml` is a fallback cron — requires `CRON_SECRET` and `VERCEL_DOMAIN` secrets set in the repo

## Supabase Setup

- Schema is already applied to the production Supabase project
- To apply to a new project: run all migrations in `supabase/migrations/` in order in the SQL editor
- Regenerate types after any schema change: `npx supabase gen types typescript --project-id hfncowvbjoaknpouivzm > src/lib/database.types.ts`
  - After regenerating, remove the `as any` cast in `createAdminClient()` in `src/lib/supabase.ts`

## Security Notes

- **RLS** is enabled on all tables — no anon access. Service role bypasses RLS automatically.
- **CRON_SECRET** is stored in Vercel environment variables and GitHub Actions secrets. Never hardcode it.
- **`.claude/settings.local.json`** is gitignored — it may contain secrets from Claude Code sessions.
- **Git remote** uses HTTPS with credentials stored in `~/.git-credentials` via `git config --global credential.helper store`. Never embed tokens in the remote URL.

## Known Gotchas

- **Node.js version:** Must use v20+ locally (`nvm use 20`). Vercel is configured to use Node 22 via `engines` in `package.json` — required by `yahoo-finance2` v3.
- **`yahoo-finance2` v3 API change:** v3 requires instantiation — `new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] })`. The old v2 default-export call pattern silently fails. See `src/lib/fetchOptionPrice.ts`.
- **LEAPS bid/ask are often $0:** After market close and early in the trading day, lightly traded LEAPS frequently have `bid=0, ask=0`. The cron runs at 19:30 UTC (3:30 PM ET, during market hours) to maximise the chance of real quotes. When bid/ask are still both $0, the code falls back to `regularMarketPrice` (last traded price) and sets `entry_price_pending=true` if this happens on auto-add.
- **`entry_price_pending` flag:** Set to `true` when an option is added via `/api/options/auto` outside market hours. The cron will backfill `entry_price` with the first live bid/ask midpoint and clear the flag. Existing options added before this feature have `entry_price_pending=false` by default.
- **`/api/options/auto` vs `/api/options/[id]` routing:** Next.js App Router correctly prioritises the static `auto` segment over the dynamic `[id]` segment. If Vercel serves a 405 after deploy, the previous build is still live — wait for the deploy to finish.
- **`createAdminClient()` returns `any`** because `database.types.ts` is a hand-written stub. All query results need explicit type casts (e.g. `const option = data as TrackedOption`). This goes away once you regenerate types from Supabase.
- **Not all OCC symbols exist on Yahoo Finance.** A symbol can parse correctly but return `undefined` from Yahoo (e.g. non-existent contracts). The fetch returns `null` and no price row is written — this is expected.
- **Supabase UI labels:** The API keys section is "API Keys" (not "API"), with "publishable key" (= anon key) and "secret key" (= service_role key). Project URL is under Settings → General.
- **`create-next-app` won't run in a non-empty directory** — scaffold in a temp dir and rsync files over if needed.
- **Recharts `Tooltip` formatter** must accept `(value: ValueType, name: NameType)` — typing as `(value: number, name: string)` causes a TypeScript build error.
