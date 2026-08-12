-- =====================================================
-- SESCINC-MANAGER: Vagas Pendentes
-- Quando um substituto deixa a sua função original para
-- cobrir férias de outro, a vaga precisa ser preenchida.
-- =====================================================

CREATE TABLE IF NOT EXISTS vagas_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',
  funcionario_ausente_id TEXT NOT NULL DEFAULT '',
  funcionario_ausente_nome TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT 'ferias',
  cadeia_ferias_id TEXT NOT NULL DEFAULT '',
  preenchido_por_id TEXT NOT NULL DEFAULT '',
  preenchido_por_nome TEXT NOT NULL DEFAULT '',
  resolvido BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

ALTER TABLE vagas_pendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vagas_pendentes_all ON vagas_pendentes;
CREATE POLICY vagas_pendentes_all ON vagas_pendentes FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vagas_equipe ON vagas_pendentes(equipe);
CREATE INDEX IF NOT EXISTS idx_vagas_resolvido ON vagas_pendentes(resolvido);
