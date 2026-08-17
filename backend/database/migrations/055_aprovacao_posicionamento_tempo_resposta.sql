ALTER TABLE exercicios_posicionamento
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Rascunho',
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_em TEXT NOT NULL DEFAULT '';

ALTER TABLE treinamentos_tempo_resposta
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Rascunho',
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprovado_em TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_exercicios_posicionamento_status ON exercicios_posicionamento(status);
CREATE INDEX IF NOT EXISTS idx_tempo_resposta_status ON treinamentos_tempo_resposta(status);

NOTIFY pgrst, 'reload schema';
