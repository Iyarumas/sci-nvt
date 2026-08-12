-- =====================================================
-- SESCINC-MANAGER: Exercícios de Posicionamento
-- Registo de exercícios de posicionamento operacional
-- =====================================================

CREATE TABLE IF NOT EXISTS exercicios_posicionamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cabeçalho
  equipe TEXT NOT NULL DEFAULT '',
  numero INTEGER NOT NULL DEFAULT 0,
  ano TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  hora TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',

  -- FAISCA 2
  faisca2_ba_mc TEXT NOT NULL DEFAULT '',
  faisca2_ba_ce TEXT NOT NULL DEFAULT '',
  faisca2_ba2 TEXT NOT NULL DEFAULT '',
  faisca2_tempo TEXT NOT NULL DEFAULT '',

  -- FAISCA 3
  faisca3_ba_mc TEXT NOT NULL DEFAULT '',
  faisca3_ba2_1 TEXT NOT NULL DEFAULT '',
  faisca3_ba2_2 TEXT NOT NULL DEFAULT '',
  faisca3_tempo TEXT NOT NULL DEFAULT '',

  -- CRS
  crs_ba_mc TEXT NOT NULL DEFAULT '',
  crs_ba_lr TEXT NOT NULL DEFAULT '',
  crs_ba_re1 TEXT NOT NULL DEFAULT '',
  crs_ba_re2 TEXT NOT NULL DEFAULT '',
  crs_tempo TEXT NOT NULL DEFAULT '',

  -- Operador de Comunicações
  operador_comunicacoes TEXT NOT NULL DEFAULT '',

  -- Textareas de avaliação
  observacoes TEXT NOT NULL DEFAULT '',
  coordenacao_twr_coe_sci TEXT NOT NULL DEFAULT '',
  comunicacao_fraseologia TEXT NOT NULL DEFAULT '',
  procedimentos_pcinc TEXT NOT NULL DEFAULT '',
  feedback_twr TEXT NOT NULL DEFAULT '',
  resumo_exercicio TEXT NOT NULL DEFAULT '',
  acionamento TEXT NOT NULL DEFAULT '',
  deslocamento_vtrs TEXT NOT NULL DEFAULT '',
  tempo_resposta TEXT NOT NULL DEFAULT '',
  feedback_sci TEXT NOT NULL DEFAULT '',
  consideracoes_finais TEXT NOT NULL DEFAULT '',
  sistema_alarmes TEXT NOT NULL DEFAULT '',
  visibilidade_superficie TEXT NOT NULL DEFAULT '',
  feedback_coe TEXT NOT NULL DEFAULT '',

  -- Metadados
  chefe_equipe TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_exercicios_posicionamento_equipe ON exercicios_posicionamento(equipe);
CREATE INDEX IF NOT EXISTS idx_exercicios_posicionamento_ano ON exercicios_posicionamento(ano);
CREATE INDEX IF NOT EXISTS idx_exercicios_posicionamento_data ON exercicios_posicionamento(data);

-- RLS
ALTER TABLE exercicios_posicionamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercicios_posicionamento_all ON exercicios_posicionamento;
CREATE POLICY exercicios_posicionamento_all ON exercicios_posicionamento FOR ALL USING (true) WITH CHECK (true);
