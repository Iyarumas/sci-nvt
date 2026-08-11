-- =====================================================
-- SESCINC-MANAGER: Vigência de Substituições
-- Resolve a cascata hierárquica de substituições:
--   A (férias) → B substitui → vaga de B → C substitui → ...
-- Tabela fonte da verdade para auto-preenchimento de escalas
-- =====================================================

CREATE TABLE IF NOT EXISTS vigencia_substituicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem está a substituir
  substituto_id TEXT NOT NULL,
  substituto_nome TEXT NOT NULL DEFAULT '',
  cargo_original_substituto TEXT NOT NULL DEFAULT '',

  -- O cargo/função que ele está a exercer (pode ser diferente do original)
  cargo_exercido TEXT NOT NULL DEFAULT '',

  -- Quem ele está a cobrir (pessoa de férias OU que subiu na cadeia)
  funcionario_original_id TEXT NOT NULL,
  funcionario_original_nome TEXT NOT NULL DEFAULT '',
  cargo_original_funcionario TEXT NOT NULL DEFAULT '',

  -- Equipa onde está efetivo (a equipa onde ele trabalha durante a substituição)
  equipe TEXT NOT NULL DEFAULT '',

  -- Período de vigência
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',

  -- Metadados da cascata
  nivel_cascata INTEGER NOT NULL DEFAULT 1,
  motivo TEXT NOT NULL DEFAULT 'ferias',
    -- 'ferias' | 'férias' = substituição por férias
    -- 'cascata' = substituição em cadeia (substituto do substituto)

  -- FK opcional para a origem (registo de férias que desencadeou a cascata)
  ferias_id TEXT,

  -- Se a vigência está ativa
  ativa BOOLEAN NOT NULL DEFAULT true,

  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_vigencia_equipe_data
  ON vigencia_substituicoes(equipe, data_inicio, data_fim);

CREATE INDEX IF NOT EXISTS idx_vigencia_substituto_ativa
  ON vigencia_substituicoes(substituto_id, ativa);

CREATE INDEX IF NOT EXISTS idx_vigencia_original_ativa
  ON vigencia_substituicoes(funcionario_original_id, ativa);

CREATE INDEX IF NOT EXISTS idx_vigencia_ferias
  ON vigencia_substituicoes(ferias_id);

-- RLS
ALTER TABLE vigencia_substituicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vigencia_substituicoes_all ON vigencia_substituicoes;
CREATE POLICY vigencia_substituicoes_all
  ON vigencia_substituicoes FOR ALL USING (true) WITH CHECK (true);
