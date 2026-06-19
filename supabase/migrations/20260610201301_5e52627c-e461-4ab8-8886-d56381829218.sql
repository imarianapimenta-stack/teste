CREATE TABLE public.app_changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  data date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_changelogs TO service_role;
ALTER TABLE public.app_changelogs ENABLE ROW LEVEL SECURITY;