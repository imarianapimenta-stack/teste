GRANT SELECT ON public.app_config TO anon, authenticated;

DROP POLICY IF EXISTS "public read app_config" ON public.app_config;
CREATE POLICY "public read app_config"
ON public.app_config
FOR SELECT
TO anon, authenticated
USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;
  END IF;
END $$;

INSERT INTO public.app_config (id, data, updated_at)
VALUES (1, '{}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;