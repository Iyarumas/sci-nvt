CREATE TABLE IF NOT EXISTS ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  data_emissao TEXT NOT NULL,
  data_conclusao TEXT NOT NULL DEFAULT '',
  solicitante_id TEXT NOT NULL DEFAULT '',
  solicitante_nome TEXT NOT NULL DEFAULT '',
  solicitante_cargo TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  imagem TEXT NOT NULL DEFAULT '',
  prioridade TEXT NOT NULL DEFAULT 'Média',
  status TEXT NOT NULL DEFAULT 'Aberta',
  motivo_manutencao TEXT NOT NULL DEFAULT '',
  manutencao_por TEXT NOT NULL DEFAULT '',
  manutencao_por_cargo TEXT NOT NULL DEFAULT '',
  manutencao_empresa TEXT NOT NULL DEFAULT '',
  data_manutencao TEXT NOT NULL DEFAULT '',
  motivo_cancelamento TEXT NOT NULL DEFAULT '',
  cancelado_por TEXT NOT NULL DEFAULT '',
  cancelado_por_cargo TEXT NOT NULL DEFAULT '',
  data_cancelamento TEXT NOT NULL DEFAULT '',
  finalizado_por TEXT NOT NULL DEFAULT '',
  finalizado_por_cargo TEXT NOT NULL DEFAULT '',
  empresa_finalizacao TEXT NOT NULL DEFAULT '',
  finalizacao_descricao TEXT NOT NULL DEFAULT '',
  data_finalizacao TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero ON ordens_servico (numero);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_created_at ON ordens_servico (created_at);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ordens_servico_public_read ON ordens_servico;
CREATE POLICY ordens_servico_public_read ON ordens_servico FOR SELECT USING (true);

DROP POLICY IF EXISTS ordens_servico_insert ON ordens_servico;
CREATE POLICY ordens_servico_insert ON ordens_servico FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS ordens_servico_update ON ordens_servico;
CREATE POLICY ordens_servico_update ON ordens_servico FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ordens_servico_delete ON ordens_servico;
CREATE POLICY ordens_servico_delete ON ordens_servico FOR DELETE USING (true);
