-- =====================================================
-- SESCINC-MANAGER: Tabela de Estoque de EPIs
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. TABELA DE ESTOQUE DE EPIS
CREATE TABLE IF NOT EXISTS epis_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  ca TEXT NOT NULL DEFAULT '',
  fornecedor TEXT NOT NULL DEFAULT '',
  quantidade INTEGER NOT NULL DEFAULT 0,
  data_fabricacao TEXT NOT NULL DEFAULT '',
  tempo_validade_meses INTEGER NOT NULL DEFAULT 0,
  data_validade TEXT NOT NULL DEFAULT '',
  tamanho TEXT NOT NULL DEFAULT '',
  numero_serie TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Novo',
  notas TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE epis_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epis_estoque_all" ON epis_estoque FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_epis_estoque_nome ON epis_estoque(nome);
CREATE INDEX IF NOT EXISTS idx_epis_estoque_ca ON epis_estoque(ca);

-- 2. GARANTIR QUE A TABELA EPIS EXISTE
CREATE TABLE IF NOT EXISTS epis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  colaborador TEXT NOT NULL DEFAULT '',
  colaborador_id TEXT NOT NULL DEFAULT '',
  entregue_por TEXT NOT NULL DEFAULT '',
  ca TEXT NOT NULL DEFAULT '',
  data_pagamento TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  fornecedor TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'entregue',
  data_envio_autentique TEXT NOT NULL DEFAULT '',
  data_assinatura TEXT NOT NULL DEFAULT '',
  data_devolucao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE epis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "epis_all" ON epis;
CREATE POLICY "epis_all" ON epis FOR ALL USING (true) WITH CHECK (true);

-- 3. ADICIONAR COLUNAS (rodar cada um separadamente se der erro)
ALTER TABLE epis ADD COLUMN IF NOT EXISTS data_fabricacao TEXT NOT NULL DEFAULT '';
ALTER TABLE epis ADD COLUMN IF NOT EXISTS tamanho TEXT NOT NULL DEFAULT '';
ALTER TABLE epis ADD COLUMN IF NOT EXISTS numero_serie TEXT NOT NULL DEFAULT '';
ALTER TABLE epis ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'Novo';
