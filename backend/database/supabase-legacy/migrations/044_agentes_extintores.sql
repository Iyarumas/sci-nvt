CREATE TABLE IF NOT EXISTS agentes_extintores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'LGE',
  quantidade NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'L',
  lote TEXT NOT NULL DEFAULT '',
  validade TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Disponivel',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

ALTER TABLE agentes_extintores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentes_extintores_all ON agentes_extintores;
CREATE POLICY agentes_extintores_all ON agentes_extintores FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agentes_extintores_tipo ON agentes_extintores(tipo);
CREATE INDEX IF NOT EXISTS idx_agentes_extintores_status ON agentes_extintores(status);
CREATE INDEX IF NOT EXISTS idx_agentes_extintores_validade ON agentes_extintores(validade);
