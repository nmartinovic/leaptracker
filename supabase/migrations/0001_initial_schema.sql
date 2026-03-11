-- Enable UUID generation
create extension if not exists "pgcrypto";

-- tracked_options: core options contracts
create table tracked_options (
  id                  uuid primary key default gen_random_uuid(),
  yahoo_symbol        text not null unique,
  ticker              text not null,
  expiration_date     date not null,
  strike_price        numeric(10,2) not null,
  option_type         char(1) not null check (option_type in ('C', 'P')),
  entry_price         numeric(10,4) not null,
  entry_date          date not null default current_date,
  spy_price_at_entry  numeric(10,4),
  tags                text[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- price_history: daily bid/ask/midpoint snapshots
create table price_history (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references tracked_options(id) on delete cascade,
  date       date not null,
  bid        numeric(10,4),
  ask        numeric(10,4),
  midpoint   numeric(10,4),
  spy_close  numeric(10,4),
  unique(option_id, date)
);

-- portfolios: named virtual portfolios
create table portfolios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- portfolio_holdings: options within portfolios
create table portfolio_holdings (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  option_id    uuid not null references tracked_options(id) on delete cascade,
  quantity     integer not null check (quantity > 0),
  cost_basis   numeric(10,4) not null,
  start_date   date not null,
  unique(portfolio_id, option_id)
);

-- Indexes for common query patterns
create index on price_history(option_id, date desc);
create index on tracked_options(is_active, expiration_date);
create index on tracked_options using gin(tags);
