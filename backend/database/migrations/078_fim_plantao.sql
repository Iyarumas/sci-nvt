-- Relatório de fim de plantão (relatório de serviço) preenchido pelo comunicante.
-- Mesmo formato do início de plantão: um por equipe e dia, com a mensagem pronta
-- e o link público temporário do QR Code.
CREATE TABLE IF NOT EXISTS fim_plantao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data TEXT NOT NULL,
  equipe TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}',
  mensagem TEXT NOT NULL DEFAULT '',
  token_publico TEXT NOT NULL,
  token_expira_em TIMESTAMPTZ NOT NULL,
  criado_por TEXT NOT NULL DEFAULT '',
  atualizado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fim_plantao_dia_equipe UNIQUE (data, equipe)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fim_plantao_token ON fim_plantao (token_publico);
