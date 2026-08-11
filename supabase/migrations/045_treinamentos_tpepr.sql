CREATE TABLE IF NOT EXISTS treinamentos_tpepr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  equipe TEXT NOT NULL DEFAULT '',
  numero INTEGER NOT NULL DEFAULT 0,
  ano TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  hora TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  participantes JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE treinamentos_tpepr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS treinamentos_tpepr_all ON treinamentos_tpepr;
CREATE POLICY treinamentos_tpepr_all ON treinamentos_tpepr FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_treinamentos_tpepr_data ON treinamentos_tpepr(data);
CREATE INDEX IF NOT EXISTS idx_treinamentos_tpepr_equipe ON treinamentos_tpepr(equipe);
CREATE INDEX IF NOT EXISTS idx_treinamentos_tpepr_ano ON treinamentos_tpepr(ano);
CREATE INDEX IF NOT EXISTS idx_treinamentos_tpepr_created_by ON treinamentos_tpepr(created_by);

NOTIFY pgrst, 'reload schema';
