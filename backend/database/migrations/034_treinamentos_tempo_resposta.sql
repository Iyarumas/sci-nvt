-- =====================================================
-- SESCINC-MANAGER: Treinamentos Tempo Resposta
-- Registo de treinamentos de tempo resposta operacional
-- =====================================================

CREATE TABLE IF NOT EXISTS treinamentos_tempo_resposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cabeçalho
  equipe TEXT NOT NULL DEFAULT '',
  numero INTEGER NOT NULL DEFAULT 0,
  ano TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  hora TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',

  -- F2
  f2_cci TEXT NOT NULL DEFAULT '',
  f2_ba_mc TEXT NOT NULL DEFAULT '',
  f2_ba_ce TEXT NOT NULL DEFAULT '',
  f2_ba2 TEXT NOT NULL DEFAULT '',
  f2_t1 TEXT NOT NULL DEFAULT '',
  f2_t2 TEXT NOT NULL DEFAULT '',
  f2_t3 TEXT NOT NULL DEFAULT '',
  f2_conceito TEXT NOT NULL DEFAULT '',
  f2_performance TEXT NOT NULL DEFAULT '',

  -- F3
  f3_cci TEXT NOT NULL DEFAULT '',
  f3_ba_mc TEXT NOT NULL DEFAULT '',
  f3_ba2_1 TEXT NOT NULL DEFAULT '',
  f3_ba2_2 TEXT NOT NULL DEFAULT '',
  f3_t1 TEXT NOT NULL DEFAULT '',
  f3_t2 TEXT NOT NULL DEFAULT '',
  f3_t3 TEXT NOT NULL DEFAULT '',
  f3_conceito TEXT NOT NULL DEFAULT '',
  f3_performance TEXT NOT NULL DEFAULT '',

  -- Textareas
  observacoes TEXT NOT NULL DEFAULT '',
  resumo_exercicio TEXT NOT NULL DEFAULT '',
  consideracoes_finais TEXT NOT NULL DEFAULT '',
  coordenacao_twr_spe_sci TEXT NOT NULL DEFAULT '',
  acionamento TEXT NOT NULL DEFAULT '',
  sistema_alarmes TEXT NOT NULL DEFAULT '',
  comunicacao_fraseologia TEXT NOT NULL DEFAULT '',
  deslocamento_vtrs TEXT NOT NULL DEFAULT '',
  visibilidade_superficie TEXT NOT NULL DEFAULT '',
  procedimento_pcinc TEXT NOT NULL DEFAULT '',
  tempo_resposta TEXT NOT NULL DEFAULT '',
  feedback_spe TEXT NOT NULL DEFAULT '',
  feedback_twr TEXT NOT NULL DEFAULT '',
  feedback_sci TEXT NOT NULL DEFAULT '',

  -- Metadados
  chefe_equipe TEXT NOT NULL DEFAULT '',
  gerente TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

CREATE INDEX IF NOT EXISTS idx_tempo_resposta_equipe ON treinamentos_tempo_resposta(equipe);
CREATE INDEX IF NOT EXISTS idx_tempo_resposta_ano ON treinamentos_tempo_resposta(ano);
CREATE INDEX IF NOT EXISTS idx_tempo_resposta_data ON treinamentos_tempo_resposta(data);

ALTER TABLE treinamentos_tempo_resposta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tempo_resposta_all ON treinamentos_tempo_resposta;
CREATE POLICY tempo_resposta_all ON treinamentos_tempo_resposta FOR ALL USING (true) WITH CHECK (true);
