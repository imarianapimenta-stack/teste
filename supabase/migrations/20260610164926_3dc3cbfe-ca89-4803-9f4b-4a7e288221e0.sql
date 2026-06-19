ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS display_id text,
  ADD COLUMN IF NOT EXISTS quick_tabs jsonb;