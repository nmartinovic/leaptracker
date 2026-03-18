-- Add entry_price_pending flag to tracked_options
-- When true, the entry_price is a placeholder (last-traded price fetched outside market hours).
-- The cron job will update entry_price with the first live bid/ask midpoint and clear this flag.
ALTER TABLE tracked_options
  ADD COLUMN entry_price_pending boolean NOT NULL DEFAULT false;
