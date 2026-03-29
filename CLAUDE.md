# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeapTracker is a Next.js options performance tracking web application. It tracks LEAPS and other options contracts daily, benchmarked against SPY. Full spec in `prd.md`.

## Tech Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript), deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password) via `@supabase/ssr` — cookie-based persistent sessions
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
  proxy.ts             # Next.js 16 proxy (middleware) — redirects unauthenticated page requests to /login; API routes bypass this and handle their own auth
  lib/               # All business logic (no UI)
    supabase.ts      # createAdminClient() — server-only admin (bypasses RLS); createSupabaseServerClient() + getCurrentUser() — session auth via cookies
    database.types.ts  # Hand-written type stub; regenerate with `npx supabase gen types`
    parseOptionSymbol.ts  # OCC symbol parser (pure, fully tested)
    fetchOptionPrice.ts   # yahoo-finance2 wrapper with retry + $0 guard; exports fetchStockPrice()
    findLeapOption.ts     # Auto-selects a LEAPS call (>=540 days, ATM strike) for a given ticker
    cronFetchPrices.ts    # Daily cron business logic; backfills entry_price when entry_price_pending=true; auto-closes #auto options after 366 days
    computePortfolioTimeSeries.ts
    formatters.ts    # formatContractName, formatPrice, formatPercent, pctChange, daysToExpiration
    marketHolidays.ts    # isTradingDay() — update annually
  app/
    login/page.tsx               # Email/password login page (public)
    signup/page.tsx              # Signup page (public)
    page.tsx                     # Dashboard (server component) — fetches live stock prices per ticker
    options/[id]/page.tsx        # Option detail view — shows stock price + vs-strike %
    portfolios/page.tsx          # Portfolio list
    portfolios/[id]/page.tsx     # Portfolio detail
    portfolios/auto/page.tsx     # Auto portfolio — all active #auto-tagged options
    api/options/route.ts         # GET + POST /api/options — requires session
    api/options/[id]/route.ts    # GET + PATCH + DELETE — requires session, filters by user_id
    api/options/auto/route.ts    # POST /api/options/auto — requires session OR CRON_SECRET header; no-ops (200) if ticker already tracked for user
    api/portfolios/route.ts      # GET + POST /api/portfolios — requires session
    api/portfolios/[id]/route.ts
    api/portfolios/[id]/holdings/route.ts
    api/cron/fetch-prices/route.ts  # Protected by CRON_SECRET header; auto-closes #auto options after 366 days
    api/auth/logout/route.ts     # POST — signs out current user
    api/admin/claim-data/route.ts  # POST — one-time: assigns all null user_id rows to the current user (run after signup to claim pre-existing data)
  components/
    DashboardClient.tsx    # Client wrapper for dashboard (filter/sort/modal state)
    AddOptionForm.tsx      # Form: Yahoo URL + entry price + tags
    AddHoldingForm.tsx
    AddHoldingModal.tsx
    CreatePortfolioButton.tsx
    LogoutButton.tsx       # Client component — calls supabase.auth.signOut() and redirects to /login
    ui/                    # Badge, PercentChange, Modal, EmptyState, LoadingSpinner, SortableTable
    charts/                # PerformanceChart (indexed/raw toggle), PortfolioChart
  tests/__tests__/         # parseOptionSymbol + formatters tests (20 tests)
supabase/migrations/
  0001_initial_schema.sql       # Core schema
  0002_entry_price_pending.sql  # Adds entry_price_pending boolean to tracked_options
  0003_enable_rls.sql           # Enables RLS on all public tables
  0004_add_user_id.sql          # Adds user_id to tracked_options and portfolios for multi-user support
```

## Architecture

### Data Model (4 tables)
- `tracked_options` — contracts with metadata; `user_id` scopes to owner; `is_active=false` after expiration or auto-close; `entry_price_pending=true` when entry price was captured outside market hours and needs backfilling
- `price_history` — daily bid/ask/midpoint + SPY close; `unique(option_id, date)` makes cron re-runs safe
- `portfolios` / `portfolio_holdings` — virtual portfolio grouping with quantity/cost_basis; `portfolios.user_id` scopes to owner

### Auth Pattern
- **`src/proxy.ts`** (Next.js 16 proxy/middleware) refreshes the Supabase session on every request and redirects unauthenticated users to `/login`. API routes (`/api/*`) are exempt — they return `401` directly.
- **Server components** call `getCurrentUser()` from `@/lib/supabase` to get the current user, then add `.eq('user_id', user?.id)` to all DB queries.
- **API routes** call `getCurrentUser()` at the top; return `401` if null.
- **`/api/options/auto`** accepts either a valid session (browser) or `Authorization: Bearer <CRON_SECRET>` header (external scripts) → uses `OWNER_USER_ID` env var as the user_id when called via CRON_SECRET.
- **All DB writes** set `user_id` explicitly so data is scoped per user.

### Key Patterns
- **Server components** do DB queries directly via `createAdminClient()`. Client components use `fetch('/api/...')`.
- **`createAdminClient()`** returns `any` until you regenerate `database.types.ts` from Supabase — add explicit type casts when calling it.
- **Yahoo Finance Symbol (OCC format):** `{TICKER}{YYMMDD}{C|P}{PRICE_IN_THOUSANDTHS}` — always prepend `20` to year. Regex: `/([A-Z]{1,6})(\d{6})([CP])(\d{8})/`
- **Cron**: skips non-trading days via `isTradingDay()`, skips options with bid=0 or ask=0, upserts on `(option_id, date)`. Backfills `entry_price` for `entry_price_pending=true` options. Auto-closes `#auto` options with `entry_date <= today - 366 days`.
- **Portfolio value**: `quantity × midpoint × 100` per holding (options represent 100 shares)
- **RLS**: Enabled on all tables. No policies needed — all access is via `service_role` key which bypasses RLS. Anon key is blocked from direct table access. User scoping is enforced at the application layer via `user_id` filters.

### API Routes
- `POST /api/options` — `{ url, entry_price, tags[] }` — parses OCC symbol, fetches initial price; requires session
- `GET /api/options?tag=foo` — returns options with computed `option_pct_change`, `spy_pct_change`, `alpha`; requires session
- `PATCH /api/options/:id` — only allows updating `tags` and `is_active`; requires session
- `POST /api/cron/fetch-prices` — requires `Authorization: Bearer <CRON_SECRET>` header
- `POST /api/options/auto` — `{ symbol: "AAPL" }` — auto-selects and tracks a LEAPS call; no-ops (200) if ticker already tracked for user; requires session or CRON_SECRET
- `POST /api/admin/claim-data` — assigns all `null user_id` rows to current user; run once after signup

### Auto-Add Flow (`POST /api/options/auto`)
1. Auth: checks session or `Authorization: Bearer <CRON_SECRET>` header
2. If ticker already has an active `#auto` option for this user → returns `{ ignored: true }` (no-op)
3. Fetches current stock price via `yf.quote(ticker)`
4. Gets available option expiration dates via `yf.options(ticker)`
5. Filters to expirations ≥ 540 days from today, picks the nearest qualifying one
6. Fetches the call option chain for that expiration
7. Finds the call with strike closest to current stock price (ATM)
8. Sets `entry_price = (bid + ask) / 2`, tags as `#auto`, sets `user_id`
9. If market is closed (bid=ask=0, fell back to last-traded price), sets `entry_price_pending=true`
10. Cron backfills `entry_price` with the first live midpoint and clears the flag

### Auto-Close Flow (in cron)
- For each active `#auto` option where `entry_date <= today - 366 days`:
  1. Final price is already recorded in `price_history` for today
  2. Sets `is_active = false`
  3. Logged as `[cron] Auto-closed <symbol>`

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=        # from Supabase project Settings > General
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # from Supabase project Settings > API Keys (publishable key)
SUPABASE_SERVICE_ROLE_KEY=       # server-only; never expose to browser (secret key)
CRON_SECRET=                     # any random string; must match Vercel + GitHub Actions secrets
OWNER_USER_ID=                   # Supabase auth user UUID of the owner; used by /api/options/auto when called with CRON_SECRET
NEXT_PUBLIC_SITE_URL=            # Full production URL e.g. https://leaptracker.vercel.app (used for logout redirect)
```

## Deployment

- **Production:** https://leaptracker.vercel.app
- **Supabase project:** `hfncowvbjoaknpouivzm` (region: us-east-1)
- **GitHub repo:** https://github.com/nmartinovic/leaptracker
- Vercel is connected to the GitHub repo — pushing to `main` triggers a redeploy automatically
- Vercel env var changes do NOT trigger a redeploy — manually redeploy from the Vercel dashboard or push an empty commit
- Vercel Cron runs `/api/cron/fetch-prices` at 19:30 UTC (3:30 PM ET) weekdays
- GitHub Actions `.github/workflows/daily-fetch.yml` is a fallback cron — requires `CRON_SECRET` and `VERCEL_DOMAIN` secrets set in the repo

## Supabase Setup

- Schema is already applied to the production Supabase project
- To apply to a new project: run all migrations in `supabase/migrations/` in order in the SQL editor
- Regenerate types after any schema change: `npx supabase gen types typescript --project-id hfncowvbjoaknpouivzm > src/lib/database.types.ts`
  - After regenerating, remove the `as any` cast in `createAdminClient()` in `src/lib/supabase.ts`
- After adding a new user, they must call `POST /api/admin/claim-data` while logged in if they have pre-existing data with `null user_id`

## Security Notes

- **RLS** is enabled on all tables — no anon access. Service role bypasses RLS automatically.
- **User scoping** is enforced at the application layer: all queries include `.eq('user_id', user.id)`. RLS is a safety net, not the primary guard.
- **CRON_SECRET** is stored in Vercel environment variables and GitHub Actions secrets. Never hardcode it.
- **OWNER_USER_ID** is the Supabase user UUID of the app owner. Options added via external API calls (using CRON_SECRET) are assigned to this user.
- **`.claude/settings.local.json`** is gitignored — it may contain secrets from Claude Code sessions.
- **Git remote** uses HTTPS with credentials stored in `~/.git-credentials` via `git config --global credential.helper store`. Never embed tokens in the remote URL.

## Known Gotchas

- **Node.js version:** Must use v20+ locally (`nvm use 20`). Vercel is configured to use Node 22 via `engines` in `package.json` — required by `yahoo-finance2` v3.
- **`yahoo-finance2` v3 API change:** v3 requires instantiation — `new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] })`. The old v2 default-export call pattern silently fails. See `src/lib/fetchOptionPrice.ts`.
- **LEAPS bid/ask are often $0:** After market close and early in the trading day, lightly traded LEAPS frequently have `bid=0, ask=0`. The cron runs at 19:30 UTC (3:30 PM ET, during market hours) to maximise the chance of real quotes. When bid/ask are still both $0, the code falls back to `regularMarketPrice` (last traded price) and sets `entry_price_pending=true` if this happens on auto-add.
- **`entry_price_pending` flag:** Set to `true` when an option is added via `/api/options/auto` outside market hours. The cron will backfill `entry_price` with the first live bid/ask midpoint and clear the flag.
- **`/api/options/auto` vs `/api/options/[id]` routing:** Next.js App Router correctly prioritises the static `auto` segment over the dynamic `[id]` segment.
- **`createAdminClient()` returns `any`** because `database.types.ts` is a hand-written stub. All query results need explicit type casts (e.g. `const option = data as TrackedOption`). This goes away once you regenerate types from Supabase.
- **Not all OCC symbols exist on Yahoo Finance.** A symbol can parse correctly but return `undefined` from Yahoo (e.g. non-existent contracts). The fetch returns `null` and no price row is written — this is expected.
- **Supabase UI labels:** The API keys section is "API Keys" (not "API"), with "publishable key" (= anon key) and "secret key" (= service_role key). Project URL is under Settings → General.
- **`proxy.ts` export name:** Next.js 16 requires the function exported from `src/proxy.ts` to be named `proxy` (not `middleware`). The `config.matcher` export works the same as before.
- **Vercel env var changes don't redeploy:** After adding/changing environment variables in Vercel, manually trigger a redeploy from the dashboard or push an empty commit.
- **Recharts `Tooltip` formatter** must accept `(value: ValueType, name: NameType)` — typing as `(value: number, name: string)` causes a TypeScript build error.
