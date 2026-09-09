ALTER TABLE agentes_extintores
  ADD COLUMN IF NOT EXISTS recipiente TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantidade_recipientes NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_recipiente NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS agentes_extintores_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia TEXT NOT NULL UNIQUE,
  data_relatorio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Rascunho',
  pq_exigido NUMERIC(12, 2) NOT NULL DEFAULT 225,
  lge_exigido NUMERIC(12, 2) NOT NULL DEFAULT 1545,
  agua_exigida NUMERIC(12, 2) NOT NULL DEFAULT 12100,
  agua_em_linha NUMERIC(12, 2) NOT NULL DEFAULT 0,
  agua_cci_rt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  agua_estoque NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reserva_tecnica_percentual NUMERIC(6, 2) NOT NULL DEFAULT 100,
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  finalizado_por TEXT NOT NULL DEFAULT '',
  finalizado_em TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS agentes_extintores_relatorio_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES agentes_extintores_relatorios(id) ON DELETE CASCADE,
  agente_extintor_id UUID REFERENCES agentes_extintores(id) ON DELETE SET NULL,
  marca_agente TEXT NOT NULL DEFAULT '',
  produto TEXT NOT NULL DEFAULT 'LGE',
  tipo TEXT NOT NULL DEFAULT '',
  dosagem TEXT NOT NULL DEFAULT '',
  classe TEXT NOT NULL DEFAULT '',
  composicao TEXT NOT NULL DEFAULT '',
  lote TEXT NOT NULL DEFAULT '',
  validade TEXT NOT NULL DEFAULT '',
  fabricacao TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT '',
  recipiente TEXT NOT NULL DEFAULT '',
  quantidade_recipientes NUMERIC(12, 2) NOT NULL DEFAULT 0,
  capacidade_recipiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
  validade_ensaio_laboratorial TEXT NOT NULL DEFAULT '',
  validade_ensaio_fogo TEXT NOT NULL DEFAULT '',
  validade_teste_hidrostatico TEXT NOT NULL DEFAULT '',
  validade_cilindro TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

CREATE TABLE IF NOT EXISTS agentes_extintores_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES agentes_extintores_relatorios(id) ON DELETE CASCADE,
  agente_extintor_id UUID REFERENCES agentes_extintores(id) ON DELETE SET NULL,
  data TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  resultado TEXT NOT NULL DEFAULT '',
  validade_resultante TEXT NOT NULL DEFAULT '',
  quantidade_anterior NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantidade_nova NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

CREATE INDEX IF NOT EXISTS idx_agentes_relatorios_competencia
  ON agentes_extintores_relatorios(competencia);
CREATE INDEX IF NOT EXISTS idx_agentes_relatorio_itens_relatorio
  ON agentes_extintores_relatorio_itens(relatorio_id);
CREATE INDEX IF NOT EXISTS idx_agentes_movimentacoes_relatorio
  ON agentes_extintores_movimentacoes(relatorio_id);
CREATE INDEX IF NOT EXISTS idx_agentes_movimentacoes_agente
  ON agentes_extintores_movimentacoes(agente_extintor_id);

NOTIFY pgrst, 'reload schema';
