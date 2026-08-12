CREATE TABLE IF NOT EXISTS substituicoes_temporarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL,
  funcionario_nome TEXT NOT NULL DEFAULT '',
  funcionario_cargo TEXT NOT NULL DEFAULT '',
  substituto_id TEXT NOT NULL,
  substituto_nome TEXT NOT NULL DEFAULT '',
  substituto_cargo TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT 'Atestado Medico',
  motivo_outro TEXT NOT NULL DEFAULT '',
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',
  dias INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacoes_rejeicao TEXT NOT NULL DEFAULT '',
  criado_por TEXT NOT NULL DEFAULT '',
  criado_por_nome TEXT NOT NULL DEFAULT '',
  aprovado_por TEXT NOT NULL DEFAULT '',
  aprovado_por_nome TEXT NOT NULL DEFAULT '',
  aprovado_em TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);
ALTER TABLE substituicoes_temporarias ENABLE ROW LEVEL SECURITY;
