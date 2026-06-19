
CREATE TABLE public.app_cliente_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  cliente_nome text NOT NULL,
  editor_id uuid NOT NULL,
  editor_username text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_cliente_logs TO service_role;

ALTER TABLE public.app_cliente_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX app_cliente_logs_created_at_idx ON public.app_cliente_logs (created_at DESC);
CREATE INDEX app_cliente_logs_cliente_id_idx ON public.app_cliente_logs (cliente_id);
