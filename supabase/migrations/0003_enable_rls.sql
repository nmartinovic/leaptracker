-- Enable Row Level Security on all public tables.
-- The app exclusively uses the service_role key server-side, which bypasses RLS,
-- so no policies are needed. This blocks direct anon/public access.
alter table public.tracked_options enable row level security;
alter table public.price_history enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_holdings enable row level security;
