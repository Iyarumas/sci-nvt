CREATE TABLE IF NOT EXISTS rea_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  numero TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aberta',
  equipe TEXT NOT NULL DEFAULT '',
  aerodromo TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  data_acidente TEXT NOT NULL DEFAULT '',
  hora_acidente TEXT NOT NULL DEFAULT '',
  matricula TEXT NOT NULL DEFAULT '',
  empresa TEXT NOT NULL DEFAULT '',
  dados JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE rea_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rea_registros_all ON rea_registros;
CREATE POLICY rea_registros_all ON rea_registros FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rea_registros_numero ON rea_registros(numero);
CREATE INDEX IF NOT EXISTS idx_rea_registros_status ON rea_registros(status);
CREATE INDEX IF NOT EXISTS idx_rea_registros_equipe ON rea_registros(equipe);
CREATE INDEX IF NOT EXISTS idx_rea_registros_data_acidente ON rea_registros(data_acidente);
