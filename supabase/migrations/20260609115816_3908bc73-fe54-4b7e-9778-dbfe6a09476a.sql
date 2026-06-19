
CREATE TABLE public.app_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  id_passaporte text NOT NULL,
  cliente_brabo boolean NOT NULL DEFAULT false,
  criado_por uuid NOT NULL REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lock down: only service_role (server functions) can access
GRANT ALL ON public.app_clientes TO service_role;
ALTER TABLE public.app_clientes ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.app_clientes_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_clientes_updated_at
BEFORE UPDATE ON public.app_clientes
FOR EACH ROW EXECUTE FUNCTION public.app_clientes_set_updated_at();

CREATE INDEX app_clientes_nome_idx ON public.app_clientes (lower(nome));
CREATE INDEX app_clientes_passaporte_idx ON public.app_clientes (lower(id_passaporte));
