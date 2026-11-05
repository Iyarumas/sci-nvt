-- Informações de início de plantão preenchidas pelo comunicante (OC).
-- Um registro por equipe e dia. A mensagem pronta fica guardada para o link
-- público temporário (QR Code) que abre o texto no WhatsApp.
CREATE TABLE IF NOT EXISTS inicio_plantao (
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
  CONSTRAINT inicio_plantao_dia_equipe UNIQUE (data, equipe)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inicio_plantao_token ON inicio_plantao (token_publico);
