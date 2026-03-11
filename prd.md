# Product Requirements Document: Options Performance Tracker

**Author:** Nick
**Version:** 1.0
**Date:** March 9, 2026
**Status:** Draft

---

## 1. Overview

The Options Performance Tracker is a lightweight, low-cost web application that allows a user to track the price performance of individual options contracts over time, benchmarked against SPY. The tool is designed for a single user who actively researches LEAPS and other options strategies and wants a persistent record of how positions evolve after identification.

The application also supports portfolio simulation, where the user can group selected options into a virtual portfolio with quantities and cost basis, and view aggregate performance over time.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Track options contract prices over time with daily midpoint snapshots
- Compare each option's performance against SPY over the same period
- Organize tracked options with user-defined tags (e.g. `#longshot`, `#stock-replacement`)
- Enable portfolio simulation with selectable options, quantities, and date ranges
- Minimize hosting and data costs (target: $0–$5/month)

### 2.2 Non-Goals

- Real-time or intraday price tracking
- Brokerage integration or trade execution
- Multi-user support or authentication (single-user tool)
- Options Greeks calculation or analytics beyond price tracking

---

## 3. User Stories

| ID | Category | Story | Priority |
|----|----------|-------|----------|
| US-1 | Add Option | As a user, I can paste a Yahoo Finance option URL (e.g. `https://finance.yahoo.com/quote/MSFT281215C00195000/`) along with a purchase price, and the system will parse the contract details (ticker, expiration, strike, type) and begin tracking it. | P0 — Must Have |
| US-2 | Tagging | As a user, I can assign one or more tags (e.g. `#longshot`, `#stock-replacement`, `#leveraged-growth`) to any tracked option for filtering and organization. | P0 — Must Have |
| US-3 | Daily Pricing | Every trading day after market close (e.g. 5:00 PM ET), the system automatically fetches the last bid and ask for each tracked option and stores the midpoint as that day's closing price. | P0 — Must Have |
| US-4 | Dashboard | On the main page, I can see all tracked options in a table showing: contract name, entry price, current midpoint price, option % gain/loss, SPY % gain/loss since the same entry date, and tags. | P0 — Must Have |
| US-5 | Detail View | When I click on an option, I see a detail page with a time-series chart showing both the option's price and SPY's price (indexed to 100 at entry date) over time, plus a table of historical daily midpoints. | P0 — Must Have |
| US-6 | Portfolio | As a user, I can create a portfolio by selecting tracked options, specifying quantity and cost basis for each, defining a start date, and viewing the aggregate portfolio value over time as a chart. | P1 — Should Have |
| US-7 | Filter/Sort | As a user, I can filter the dashboard by tag and sort by any column (% gain, entry date, expiration, etc.). | P1 — Should Have |

---

## 4. Data Model

### 4.1 Option Contract (`tracked_options`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `yahoo_symbol` | string | Yahoo Finance symbol (e.g. `MSFT281215C00195000`) |
| `ticker` | string | Underlying ticker (e.g. `MSFT`) |
| `expiration_date` | date | Option expiration date, parsed from symbol |
| `strike_price` | decimal | Strike price, parsed from symbol |
| `option_type` | enum(C,P) | Call or Put |
| `entry_price` | decimal | User-provided price at time of addition |
| `entry_date` | date | Date the option was added to tracking |
| `spy_price_at_entry` | decimal | SPY closing price on `entry_date` |
| `tags` | string[] | User-defined tags (e.g. `["longshot", "leveraged-growth"]`) |
| `is_active` | boolean | Whether the option is still being tracked (false after expiration or manual archive) |
| `created_at` | timestamp | Record creation timestamp |

### 4.2 Daily Price Snapshot (`price_history`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `option_id` | FK → tracked_options | Reference to the tracked option |
| `date` | date | Trading date |
| `bid` | decimal | Last bid price |
| `ask` | decimal | Last ask price |
| `midpoint` | decimal | Calculated: (bid + ask) / 2 |
| `spy_close` | decimal | SPY closing price on this date |

### 4.3 Portfolio (`portfolios`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Portfolio name (e.g. "LEAPS Q1 2026") |
| `created_at` | timestamp | Record creation timestamp |

### 4.4 Portfolio Holdings (`portfolio_holdings`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `portfolio_id` | FK → portfolios | Reference to the portfolio |
| `option_id` | FK → tracked_options | Reference to the tracked option |
| `quantity` | integer | Number of contracts |
| `cost_basis` | decimal | Price per contract at entry (may differ from `entry_price` if added later) |
| `start_date` | date | Date this holding begins tracking in the portfolio |

---

## 5. Recommended Architecture

This section outlines a cost-optimized architecture targeting $0–$5/month in hosting costs, suitable for a single-user tool.

### 5.1 Tech Stack

| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| Frontend | Next.js (App Router) on Vercel | Free tier covers single-user traffic. SSR for dashboard, client components for interactivity. |
| Database | Supabase (PostgreSQL) or Turso (SQLite) | Both have generous free tiers. Supabase offers full Postgres with REST API. Turso offers edge SQLite with near-zero latency. |
| Scheduled Jobs | GitHub Actions (cron) or Vercel Cron | Free for public repos. Runs daily at 5:15 PM ET to fetch option prices after market close. |
| Price Data | Yahoo Finance (yfinance / web scraping) | Free, no API key required. Use `yahoo-finance2` npm package or Python `yfinance` for the cron job. |
| Charts | Recharts or Chart.js | Free, React-native charting. Recharts integrates cleanly with Next.js. |
| Auth (optional) | Simple API key or none | Single user — a simple env-var API key or basic auth is sufficient. Avoid full auth providers to reduce complexity. |

### 5.2 System Flow

**Add Option:** User pastes Yahoo Finance URL → Frontend parses symbol from URL → Validates against Yahoo Finance API → Fetches current bid/ask and SPY price → Stores in `tracked_options` and creates first `price_history` entry.

**Daily Cron (5:15 PM ET):** GitHub Action triggers → Fetches all active tracked options → For each, calls Yahoo Finance for bid/ask → Also fetches SPY close → Inserts rows into `price_history`.

**Dashboard Load:** Queries `tracked_options` joined with latest `price_history` → Computes % change for option and SPY → Renders table with sorting/filtering.

**Detail View:** Queries full `price_history` for the option → Indexes both option and SPY price to 100 at `entry_date` → Renders dual-line time-series chart.

**Portfolio View:** For each holding, queries `price_history` from `start_date` → Computes daily portfolio value (sum of quantity × midpoint × 100 for each holding) → Renders portfolio value over time vs. equivalent SPY investment.

---

## 6. Yahoo Finance URL Parsing

Yahoo Finance option symbols follow a standard OCC format. The application must parse the URL to extract contract details.

### 6.1 Symbol Format

**Pattern:** `{TICKER}{YYMMDD}{C|P}{PRICE_IN_THOUSANDTHS}`

**Example:** `MSFT281215C00195000`

- `MSFT` → Ticker: Microsoft
- `281215` → Expiration: December 15, 2028
- `C` → Type: Call
- `00195000` → Strike: $195.00 (divide by 1000)

### 6.2 Parsing Logic

The parser should handle variable-length tickers (1–6 characters) by scanning for the first digit after the URL path. A regex like `/\/quote\/([A-Z]{1,6})(\d{6})([CP])(\d{8})\/?/` will extract all components. The strike price requires dividing the 8-digit integer by 1000.

---

## 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/options` | Add a new option to track. Body: `{ url, entry_price, tags[] }` |
| `GET` | `/api/options` | List all tracked options with latest price data. Supports `?tag=` filter. |
| `GET` | `/api/options/:id` | Get option detail with full price history. |
| `PATCH` | `/api/options/:id` | Update tags or archive an option. |
| `DELETE` | `/api/options/:id` | Remove an option and its price history. |
| `POST` | `/api/portfolios` | Create a new portfolio. |
| `GET` | `/api/portfolios` | List all portfolios. |
| `GET` | `/api/portfolios/:id` | Get portfolio with holdings and historical performance data. |
| `POST` | `/api/portfolios/:id/holdings` | Add a holding to a portfolio. Body: `{ option_id, quantity, cost_basis, start_date }` |
| `POST` | `/api/cron/fetch-prices` | Triggered by cron. Fetches and stores daily prices for all active options. Protected by secret. |

---

## 8. UI Specifications

### 8.1 Dashboard (Main Page)

The dashboard displays a filterable, sortable table of all tracked options. Key columns:

- **Contract** (e.g. "MSFT Dec 2028 $195 Call") — clickable link to detail view
- **Entry Price** — the user-provided price when the option was added
- **Current Price** — latest midpoint from `price_history`
- **Option % Change** — color-coded green/red
- **SPY % Change** — since the same entry date, color-coded
- **Alpha** — Option % Change minus SPY % Change
- **Tags** — displayed as colored chips, clickable to filter
- **Entry Date** and **Expiration Date**

Above the table: a tag filter bar and an "Add Option" button that opens a modal/form.

### 8.2 Detail View

Displays a single option's performance in detail:

- **Header:** contract name, underlying ticker, expiration, strike, type
- **Summary cards:** entry price, current price, % change, SPY % change, alpha, days held, days to expiration
- **Chart:** dual-line time series with both option price and SPY indexed to 100 at entry date. Toggle between indexed view and raw price view.
- **Table:** scrollable daily history showing date, bid, ask, midpoint, SPY close, and daily change

### 8.3 Portfolio View

Displays a portfolio's aggregate performance:

- **Holdings table:** option name, quantity, cost basis, current value, % change, weight in portfolio
- **Chart:** portfolio total value over time vs. equivalent SPY investment (same initial dollar amount invested in SPY)
- **Summary:** total invested, current value, total return, SPY return, alpha

---

## 9. Cron Job Specification

### 9.1 Schedule

Runs Monday–Friday at 5:15 PM Eastern Time (21:15 UTC during EST, 22:15 UTC during EDT). Skips weekends and US market holidays.

### 9.2 Logic

1. Query all tracked options where `is_active = true` and `expiration_date >= today`.
2. For each option, fetch the current bid and ask from Yahoo Finance.
3. Fetch SPY closing price (one call, reused for all options).
4. Compute midpoint = (bid + ask) / 2 for each option.
5. Insert `price_history` rows.
6. If any option has `expiration_date < today`, set `is_active = false`.
7. Log results and any errors (e.g. Yahoo Finance rate limits, invalid symbols).

### 9.3 Error Handling

- If Yahoo Finance returns no data for an option (e.g. low liquidity), skip and log a warning.
- If bid or ask is 0, do not store a midpoint (avoid storing $0 prices).
- Implement retry with exponential backoff for transient HTTP errors.

---

## 10. Cost Analysis

| Service | Free Tier | Expected Usage | Monthly Cost |
|---------|-----------|---------------|-------------|
| Vercel Hosting | 100 GB bandwidth, serverless functions | < 1 GB/month for single user | $0 |
| Supabase / Turso | 500 MB (Supabase) or 9 GB (Turso) | < 10 MB (a few hundred options, daily rows) | $0 |
| GitHub Actions | 2,000 min/month (public repo) | ~5 min/day = ~150 min/month | $0 |
| Yahoo Finance Data | Unofficial / free | ~50–100 API calls/day | $0 |
| Domain (optional) | N/A | Custom domain | $0–$1/mo |

**Estimated Total: $0–$1/month** — well within the $5/month budget constraint.

---

## 11. Open Questions and Future Considerations

1. **Yahoo Finance reliability:** The unofficial API may change or rate-limit. Consider a fallback data source (e.g. CBOE delayed data, or storing the Yahoo Finance page HTML and scraping).
2. **Options with no bid/ask:** Some deep OTM or illiquid options may have $0 bids. The system should handle these gracefully (skip or show last known price).
3. **Market holidays:** Should the cron job maintain a holiday calendar, or simply skip days where Yahoo Finance returns no new data?
4. **Historical backfill:** If a user adds an option that has been trading for months, should the system attempt to backfill historical prices?
5. **Notifications:** Future feature — email or push alerts when an option hits a price target or RSI threshold.
6. **Greeks integration:** Future feature — display delta, gamma, theta, IV alongside price data using a pricing model.

---

## 12. Success Metrics

- All tracked options have daily price snapshots with < 1% missing trading days
- Dashboard loads in < 2 seconds for up to 100 tracked options
- Monthly infrastructure cost remains at $0–$5
- Cron job completes successfully on > 95% of trading days
- Adding a new option takes < 30 seconds from URL paste to tracking