
-- App users table (custom username/password auth — not Supabase auth)
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'mecanico' CHECK (role IN ('admin','mecanico')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('approved','pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO anon, authenticated;
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- App config (singleton row)
CREATE TABLE public.app_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access app_config" ON public.app_config FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;

-- Seed root admin
INSERT INTO public.app_users (username, password, role, status)
VALUES ('admin', 'admin123', 'admin', 'approved')
ON CONFLICT (username) DO NOTHING;

-- Seed default config
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
