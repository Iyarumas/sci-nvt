-- =====================================================
-- SESCINC-MANAGER: All remaining tables for new Supabase project
-- Execute this SQL in the Supabase SQL Editor
-- =====================================================

-- 1. OCORRENCIAS
CREATE TABLE IF NOT EXISTS ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  tipo_documento TEXT NOT NULL,
  numero TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  hora TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',
  envolvidos TEXT NOT NULL DEFAULT '',
  acoes_tomadas TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aberta',
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocorrencias_all" ON ocorrencias FOR ALL USING (true) WITH CHECK (true);

-- 2. LRO_OCORRENCIAS
CREATE TABLE IF NOT EXISTS lro_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  data_entrada TEXT NOT NULL DEFAULT '',
  data_saida TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  apoc TEXT NOT NULL DEFAULT '',
  cci02_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  cci03_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  crs_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  apoio_outros_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  substituicoes_ativo BOOLEAN NOT NULL DEFAULT false,
  substituicoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  instrucoes TEXT NOT NULL DEFAULT '',
  faisca2 JSONB NOT NULL DEFAULT '{}'::jsonb,
  faisca3 JSONB NOT NULL DEFAULT '{}'::jsonb,
  faisca_rt JSONB NOT NULL DEFAULT '{}'::jsonb,
  crs JSONB NOT NULL DEFAULT '{}'::jsonb,
  situacao_central_faisca TEXT NOT NULL DEFAULT '',
  situacao_comunicacao TEXT NOT NULL DEFAULT '',
  situacao_tpepr TEXT NOT NULL DEFAULT '',
  situacao_agentes_extintores TEXT NOT NULL DEFAULT '',
  situacao_equipamentos TEXT NOT NULL DEFAULT '',
  situacao_edificacoes TEXT NOT NULL DEFAULT '',
  inspecoes_tecnicas TEXT NOT NULL DEFAULT '',
  emergencias_aeronauticas TEXT NOT NULL DEFAULT '',
  outras_ocorrencias TEXT NOT NULL DEFAULT '',
  assinatura TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lro_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lro_ocorrencias_all" ON lro_ocorrencias FOR ALL USING (true) WITH CHECK (true);

-- 3. FERIAS
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
CREATE POLICY "ferias_all" ON ferias FOR ALL USING (true) WITH CHECK (true);

-- 4. VIATURAS
CREATE TABLE IF NOT EXISTS viaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefixo TEXT NOT NULL DEFAULT '',
  placa TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  ano TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'Ativa',
  equipe TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE viaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viaturas_all" ON viaturas FOR ALL USING (true) WITH CHECK (true);

-- 5. CERTIFICACOES
CREATE TABLE IF NOT EXISTS certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL DEFAULT '',
  funcionario_nome TEXT NOT NULL DEFAULT '',
  nr_numero TEXT NOT NULL DEFAULT '',
  nr_nome TEXT NOT NULL DEFAULT '',
  data_emissao TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  empresa TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE certificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificacoes_all" ON certificacoes FOR ALL USING (true) WITH CHECK (true);

-- 6. EPIS
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
CREATE POLICY "epis_all" ON epis FOR ALL USING (true) WITH CHECK (true);

-- 7. ESCALAS
CREATE TABLE IF NOT EXISTS escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  data_plantao TEXT NOT NULL DEFAULT '',
  horario_inicio TEXT NOT NULL DEFAULT '',
  horario_termino TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  guarnicoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  bds JSONB NOT NULL DEFAULT '{}'::jsonb,
  ptr1 JSONB NOT NULL DEFAULT '{}'::jsonb,
  ptr2 JSONB NOT NULL DEFAULT '{}'::jsonb,
  atestados JSONB NOT NULL DEFAULT '[]'::jsonb,
  trocas JSONB NOT NULL DEFAULT '[]'::jsonb,
  radio JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalas_all" ON escalas FOR ALL USING (true) WITH CHECK (true);

-- 8. SUBSTITUICOES
CREATE TABLE IF NOT EXISTS substituicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferias_id TEXT NOT NULL DEFAULT '',
  funcionario_id TEXT NOT NULL DEFAULT '',
  funcionario_nome TEXT NOT NULL DEFAULT '',
  substituto_id TEXT NOT NULL DEFAULT '',
  substituto_nome TEXT NOT NULL DEFAULT '',
  funcao_substituicao TEXT NOT NULL DEFAULT '',
  data_inicio TEXT NOT NULL DEFAULT '',
  data_fim TEXT NOT NULL DEFAULT '',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE substituicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "substituicoes_all" ON substituicoes FOR ALL USING (true) WITH CHECK (true);

-- 9. EQUIPAMENTOS
CREATE TABLE IF NOT EXISTS equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  numero_serie TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'Operacional',
  data_aquisicao TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  responsavel TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipamentos_all" ON equipamentos FOR ALL USING (true) WITH CHECK (true);

-- 10. AGENTES_EXTINTORES
CREATE TABLE IF NOT EXISTS agentes_extintores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_agente TEXT NOT NULL DEFAULT '',
  capacidade TEXT NOT NULL DEFAULT '',
  numero_serie TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  data_recarga TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'Valido',
  fabricante TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agentes_extintores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agentes_extintores_all" ON agentes_extintores FOR ALL USING (true) WITH CHECK (true);

-- 11. HIDRANTES
CREATE TABLE IF NOT EXISTS hidrantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  pressao TEXT NOT NULL DEFAULT '',
  diametro TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'Ativo',
  ultimo_teste TEXT NOT NULL DEFAULT '',
  proximo_teste TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE hidrantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hidrantes_all" ON hidrantes FOR ALL USING (true) WITH CHECK (true);

-- 12. CHECKLISTS
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklists_all" ON checklists FOR ALL USING (true) WITH CHECK (true);

-- 13. INSPECOES
CREATE TABLE IF NOT EXISTS inspecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID,
  responsavel TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  data_inspecao TEXT NOT NULL DEFAULT '',
  resultado TEXT NOT NULL DEFAULT '',
  itens_verificados JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacoes TEXT NOT NULL DEFAULT '',
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE inspecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inspecoes_all" ON inspecoes FOR ALL USING (true) WITH CHECK (true);

-- 14. TREINAMENTOS
CREATE TABLE IF NOT EXISTS treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data TEXT NOT NULL DEFAULT '',
  hora_inicio TEXT NOT NULL DEFAULT '',
  hora_termino TEXT NOT NULL DEFAULT '',
  duracao TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  participantes JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacoes TEXT NOT NULL DEFAULT '',
  instrutor TEXT NOT NULL DEFAULT '',
  assunto_ministrado TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  informacoes_complementares TEXT NOT NULL DEFAULT '',
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE treinamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treinamentos_all" ON treinamentos FOR ALL USING (true) WITH CHECK (true);

-- 15. USUARIOS (if not exists)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lider',
  previous_role TEXT,
  person_id TEXT,
  person_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios_all" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ocorrencias_equipe ON ocorrencias(equipe);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_lro_equipe ON lro_ocorrencias(equipe);
CREATE INDEX IF NOT EXISTS idx_ferias_funcionario ON ferias(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_viaturas_equipe ON viaturas(equipe);
CREATE INDEX IF NOT EXISTS idx_certificacoes_funcionario ON certificacoes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_epis_colaborador ON epis(colaborador);
CREATE INDEX IF NOT EXISTS idx_escalas_equipe ON escalas(equipe);
CREATE INDEX IF NOT EXISTS idx_substituicoes_ativa ON substituicoes(ativa);
CREATE INDEX IF NOT EXISTS idx_treinamentos_equipe ON treinamentos(equipe);
