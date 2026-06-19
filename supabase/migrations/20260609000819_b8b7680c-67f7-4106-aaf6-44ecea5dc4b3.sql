
-- Announcements
CREATE TABLE public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
GRANT SELECT ON public.app_announcements TO anon, authenticated;
GRANT ALL ON public.app_announcements TO service_role;
ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read announcements" ON public.app_announcements FOR SELECT USING (true);

-- Time clock
CREATE TABLE public.app_timeclock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entry_at timestamptz not null default now(),
  exit_at timestamptz
);
CREATE INDEX app_timeclock_user_idx ON public.app_timeclock(user_id, entry_at desc);
GRANT SELECT ON public.app_timeclock TO anon, authenticated;
GRANT ALL ON public.app_timeclock TO service_role;
ALTER TABLE public.app_timeclock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read timeclock" ON public.app_timeclock FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_timeclock;
