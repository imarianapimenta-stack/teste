
-- Enable bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remove app_users from realtime (was leaking credentials)
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_users;

-- Drop open policies
DROP POLICY IF EXISTS "open access app_users" ON public.app_users;
DROP POLICY IF EXISTS "open access app_config" ON public.app_config;

-- Revoke direct client access; only service_role (used by server fns) keeps access
REVOKE ALL ON public.app_users FROM anon, authenticated;
REVOKE ALL ON public.app_config FROM anon, authenticated;

-- Allow anon/authenticated to READ config only (for realtime price sync)
GRANT SELECT ON public.app_config TO anon, authenticated;
CREATE POLICY "public read app_config" ON public.app_config FOR SELECT USING (true);

-- (app_users has RLS enabled and no policies => no client access at all)

-- Hash any existing plaintext passwords (the seeded admin)
UPDATE public.app_users
SET password = crypt(password, gen_salt('bf', 10))
WHERE password NOT LIKE '$2%';

-- Sessions table (token-based auth managed by server fns)
CREATE TABLE public.app_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role can access
