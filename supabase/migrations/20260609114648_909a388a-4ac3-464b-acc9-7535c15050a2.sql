
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'mecanico' CHECK (role IN ('admin','mecanico')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('approved','pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read app_config" ON public.app_config FOR SELECT USING (true);

CREATE TABLE public.app_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

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

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_timeclock;

INSERT INTO public.app_users (username, password, role, status)
VALUES ('admin', crypt('admin123', gen_salt('bf', 10)), 'admin', 'approved')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.app_config (id, data) VALUES (1, '{
  "margemTunagem": 65,
  "descontoParceria": 20,
  "conserto": {"mec": 1100, "sul": 1500, "norte": 1900},
  "reboque": {"sul": 1100, "norte": 1500, "explodido": 400},
  "adicionalKits": {"sul": 750, "norte": 1500},
  "produtos": {"chaveInglesa": 2300, "kitBasico": 1100, "kitAvancado": 3400, "pneu": 1100, "ursinho": 5000},
  "pneuZona": 1100
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
