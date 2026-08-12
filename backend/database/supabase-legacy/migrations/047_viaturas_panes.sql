-- Tabela de panes (falhas/defeitos) por viatura
CREATE TABLE IF NOT EXISTS viatura_panes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viatura_id UUID NOT NULL REFERENCES viaturas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL DEFAULT '',
  data_registro TEXT NOT NULL DEFAULT '',
  registrado_por TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aberta',
  resolvida_em TEXT,
  resolvida_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE viatura_panes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viatura_panes_all" ON viatura_panes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_viatura_panes_viatura ON viatura_panes(viatura_id);
