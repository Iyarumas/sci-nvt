CREATE TABLE IF NOT EXISTS public.auditoria_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  tabela text NOT NULL,
  registro_id text NOT NULL,
  identificacao text NOT NULL,
  usuario_id text,
  usuario_login text,
  usuario_funcao text,
  origem text NOT NULL CHECK (origem IN ('sistema', 'sem_usuario')),
  usuario_banco text NOT NULL
);

CREATE INDEX IF NOT EXISTS auditoria_exclusoes_data_idx ON public.auditoria_exclusoes (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS auditoria_exclusoes_tabela_data_idx ON public.auditoria_exclusoes (tabela, created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_exclusao_auditada() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  registro jsonb := to_jsonb(OLD);
  ator jsonb := coalesce(nullif(current_setting('app.audit_actor', true), ''), '{}')::jsonb;
BEGIN
  INSERT INTO public.auditoria_exclusoes (
    tabela, registro_id, identificacao, usuario_id, usuario_login, usuario_funcao, origem, usuario_banco
  ) VALUES (
    TG_TABLE_NAME,
    coalesce(registro->>'id', ''),
    left(coalesce(
      nullif(registro->>'nome_guerra', ''), nullif(registro->>'nome_completo', ''),
      nullif(registro->>'name', ''), nullif(registro->>'nome', ''),
      nullif(registro->>'titulo', ''), nullif(registro->>'numero', ''),
      nullif(registro->>'username', ''), registro->>'id', TG_TABLE_NAME
    ), 240),
    ator->>'id', ator->>'username', ator->>'role',
    CASE WHEN nullif(ator->>'id', '') IS NOT NULL THEN 'sistema' ELSE 'sem_usuario' END,
    session_user
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_auditoria_exclusoes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de exclusões não pode ser alterado ou apagado.';
END;
$$;

DROP TRIGGER IF EXISTS proteger_auditoria_exclusoes ON public.auditoria_exclusoes;
CREATE TRIGGER proteger_auditoria_exclusoes BEFORE UPDATE OR DELETE OR TRUNCATE ON public.auditoria_exclusoes
FOR EACH STATEMENT EXECUTE FUNCTION public.proteger_auditoria_exclusoes();

DO $$
DECLARE
  nome_tabela text;
BEGIN
  FOR nome_tabela IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename NOT IN ('auditoria_exclusoes', 'schema_migrations')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auditar_exclusao ON public.%I', nome_tabela);
    EXECUTE format('CREATE TRIGGER auditar_exclusao AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_exclusao_auditada()', nome_tabela);
  END LOOP;
END;
$$;
