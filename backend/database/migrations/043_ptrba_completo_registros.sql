CREATE TABLE IF NOT EXISTS ptrba_completo_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  data TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  identificacao_aeroporto TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  participantes JSONB NOT NULL DEFAULT '[]',
  evidencias JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE ptrba_completo_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ptrba_completo_registros_all ON ptrba_completo_registros;
CREATE POLICY ptrba_completo_registros_all ON ptrba_completo_registros FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ptrba_completo_registros_data ON ptrba_completo_registros(data);
CREATE INDEX IF NOT EXISTS idx_ptrba_completo_registros_equipe ON ptrba_completo_registros(equipe);
CREATE INDEX IF NOT EXISTS idx_ptrba_completo_registros_created_by ON ptrba_completo_registros(created_by);
