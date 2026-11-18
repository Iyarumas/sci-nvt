-- Pré-preenchimentos de Tipo e Descrição cadastrados pelo administrador para padronizar
-- os registros diários. Cada modelo vale para uma tela só:
-- 'ocorrencias' (LRO/Ocorrências), 'inspecoes' ou 'solicitacoes'.
CREATE TABLE IF NOT EXISTS pre_preenchimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tela TEXT NOT NULL CHECK (tela IN ('ocorrencias', 'inspecoes', 'solicitacoes')),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_preenchimentos_tela ON pre_preenchimentos (tela);
