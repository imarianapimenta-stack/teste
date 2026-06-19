
-- Drop public SELECT policies
DROP POLICY IF EXISTS "public read timeclock" ON public.app_timeclock;
DROP POLICY IF EXISTS "public read app_config" ON public.app_config;
DROP POLICY IF EXISTS "public read announcements" ON public.app_announcements;

-- Remove tables from realtime publication (prevents broadcasting changes)
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_timeclock;
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_config;
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_announcements;

-- Revoke direct table access from anon/authenticated; only service_role (server functions) should access these
REVOKE ALL ON public.app_users FROM anon, authenticated;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;
REVOKE ALL ON public.app_timeclock FROM anon, authenticated;
REVOKE ALL ON public.app_config FROM anon, authenticated;
REVOKE ALL ON public.app_announcements FROM anon, authenticated;

GRANT ALL ON public.app_users TO service_role;
GRANT ALL ON public.app_sessions TO service_role;
GRANT ALL ON public.app_timeclock TO service_role;
GRANT ALL ON public.app_config TO service_role;
GRANT ALL ON public.app_announcements TO service_role;
