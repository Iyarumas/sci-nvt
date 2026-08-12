-- Suporte para afastamentos com corrente de substituicoes no modulo Funcionarios.
ALTER TABLE substituicoes_temporarias
  ADD COLUMN IF NOT EXISTS cadeia_substituicao JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_substituicoes_temporarias_tipo_status_periodo
  ON substituicoes_temporarias (tipo, status, data_inicio, data_fim);
