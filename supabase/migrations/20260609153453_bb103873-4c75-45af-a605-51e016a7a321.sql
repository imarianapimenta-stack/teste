
CREATE TABLE public.app_sugestoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  username text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'nova',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_sugestoes TO service_role;

ALTER TABLE public.app_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX app_sugestoes_user_id_idx ON public.app_sugestoes(user_id);
CREATE INDEX app_sugestoes_created_at_idx ON public.app_sugestoes(created_at DESC);
