ALTER TABLE treinamentos_taf
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Rascunho',
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_em TEXT NOT NULL DEFAULT '';

ALTER TABLE treinamentos_tpepr
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Rascunho',
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_em TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_taf_status ON treinamentos_taf(status);
CREATE INDEX IF NOT EXISTS idx_treinamentos_tpepr_status ON treinamentos_tpepr(status);

NOTIFY pgrst, 'reload schema';
