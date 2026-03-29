-- Add user_id to tracked_options and portfolios for multi-user support.
-- Nullable so existing rows are preserved; owner should run the claim-data
-- endpoint after signing up to assign all existing rows to their account.

alter table public.tracked_options
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.portfolios
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Indexes for fast per-user lookups
create index if not exists tracked_options_user_id_idx on public.tracked_options(user_id);
create index if not exists portfolios_user_id_idx on public.portfolios(user_id);
