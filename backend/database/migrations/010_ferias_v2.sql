-- =====================================================
-- SESCINC-MANAGER: Férias v2 - Escalas e Aprovações
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. TABELA DE ESCALAS DE FERIAS (criadas pelo chefe)
CREATE TABLE IF NOT EXISTS ferias_escala (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe TEXT NOT NULL DEFAULT '',
  ano INTEGER NOT NULL DEFAULT 0,
  chefe_id TEXT NOT NULL DEFAULT '',
  chefe_nome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Rascunho',
  observacoes_rejeicao TEXT NOT NULL DEFAULT '',
  aprovado_por TEXT NOT NULL DEFAULT '',
  aprovado_por_nome TEXT NOT NULL DEFAULT '',
  aprovado_em TEXT NOT NULL DEFAULT '',
  enviado_em TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ferias_escala ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ferias_escala_all" ON ferias_escala;
CREATE POLICY "ferias_escala_all" ON ferias_escala FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ferias_escala_equipe_ano ON ferias_escala(equipe, ano);

-- 2. ITENS DA ESCALA (um por mes)
CREATE TABLE IF NOT EXISTS ferias_escala_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID REFERENCES ferias_escala(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL DEFAULT 0,
  funcionario_id TEXT NOT NULL DEFAULT '',
  funcionario_nome TEXT NOT NULL DEFAULT '',
  funcao TEXT NOT NULL DEFAULT '',
  dias INTEGER NOT NULL DEFAULT 30,
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',
  substituto_id TEXT NOT NULL DEFAULT '',
  substituto_nome TEXT NOT NULL DEFAULT '',
  funcao_substituicao TEXT NOT NULL DEFAULT '',
  feirista_id TEXT NOT NULL DEFAULT '',
  feirista_nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ferias_escala_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ferias_escala_item_all" ON ferias_escala_item;
CREATE POLICY "ferias_escala_item_all" ON ferias_escala_item FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ferias_escala_item_escala ON ferias_escala_item(escala_id);

-- 3. GARANTIR QUE A TABELA FERIAS EXISTE
CREATE TABLE IF NOT EXISTS ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL DEFAULT '',
  funcionario_nome TEXT NOT NULL DEFAULT '',
  periodo TEXT NOT NULL DEFAULT '',
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',
  dias INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Programadas',
  substituto_id TEXT NOT NULL DEFAULT '',
  substituto_nome TEXT NOT NULL DEFAULT '',
  funcao_substituicao TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ferias_all" ON ferias;
CREATE POLICY "ferias_all" ON ferias FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ferias_funcionario ON ferias(funcionario_id);

-- 4. ADICIONAR COLUNAS NA TABELA FERIAS
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS equipe TEXT NOT NULL DEFAULT '';
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS periodo_numero INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS modificado_por TEXT NOT NULL DEFAULT '';
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false;
