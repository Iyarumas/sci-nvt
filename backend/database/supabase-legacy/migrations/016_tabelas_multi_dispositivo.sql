-- Tabelas para dados antes apenas no localStorage (migração multi-dispositivo)

-- 1. Certificacoes NR
CREATE TABLE IF NOT EXISTS certificacoes_nr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL,
  funcionario_nome TEXT NOT NULL DEFAULT '',
  nr_numero TEXT NOT NULL DEFAULT '',
  nr_nome TEXT NOT NULL DEFAULT '',
  data_emissao TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  empresa TEXT NOT NULL DEFAULT '',
  arquivo TEXT NOT NULL DEFAULT '',
  tipo_arquivo TEXT NOT NULL DEFAULT 'image',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE certificacoes_nr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificacoes_nr_all ON certificacoes_nr;
CREATE POLICY certificacoes_nr_all ON certificacoes_nr FOR ALL USING (true) WITH CHECK (true);

-- 2. Chat mensagens
CREATE TABLE IF NOT EXISTS chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de TEXT NOT NULL,
  de_nome TEXT NOT NULL DEFAULT '',
  para TEXT,
  para_nome TEXT,
  texto TEXT NOT NULL DEFAULT '',
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_mensagens_all ON chat_mensagens;
CREATE POLICY chat_mensagens_all ON chat_mensagens FOR ALL USING (true) WITH CHECK (true);

-- 3. Equipamentos operacionais
CREATE TABLE IF NOT EXISTS equipamentos_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  numero_serie TEXT NOT NULL DEFAULT '',
  data_aquisicao TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  vida_util_meses TEXT NOT NULL DEFAULT '',
  responsavel TEXT NOT NULL DEFAULT '',
  responsavel_id TEXT,
  responsavel_tipo TEXT,
  localizacao TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Operacional',
  foto_url TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE equipamentos_operacionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipamentos_operacionais_all ON equipamentos_operacionais;
CREATE POLICY equipamentos_operacionais_all ON equipamentos_operacionais FOR ALL USING (true) WITH CHECK (true);

-- 4. Escalas diarias
CREATE TABLE IF NOT EXISTS escalas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  data_plantao TEXT NOT NULL DEFAULT '',
  horario_inicio TEXT NOT NULL DEFAULT '',
  horario_termino TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  guarnicoes JSONB NOT NULL DEFAULT '{}',
  bds JSONB NOT NULL DEFAULT '{}',
  ptr1 JSONB NOT NULL DEFAULT '{}',
  ptr2 JSONB NOT NULL DEFAULT '{}',
  atestados JSONB NOT NULL DEFAULT '[]',
  trocas JSONB NOT NULL DEFAULT '[]',
  radio JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE escalas_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalas_diarias_all ON escalas_diarias;
CREATE POLICY escalas_diarias_all ON escalas_diarias FOR ALL USING (true) WITH CHECK (true);

-- 5. LROs (registros diarios)
CREATE TABLE IF NOT EXISTS registros_lro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  data_entrada TEXT NOT NULL DEFAULT '',
  data_saida TEXT NOT NULL DEFAULT '',
  chefe_equipe TEXT NOT NULL DEFAULT '',
  apoc TEXT NOT NULL DEFAULT '',
  cci02_slots JSONB NOT NULL DEFAULT '[]',
  cci03_slots JSONB NOT NULL DEFAULT '[]',
  crs_slots JSONB NOT NULL DEFAULT '[]',
  apoio_outros_slots JSONB NOT NULL DEFAULT '[]',
  substituicoes_ativo BOOLEAN NOT NULL DEFAULT false,
  substituicoes JSONB NOT NULL DEFAULT '[]',
  instrucoes TEXT NOT NULL DEFAULT '',
  faisca2 JSONB NOT NULL DEFAULT '{}',
  faisca3 JSONB NOT NULL DEFAULT '{}',
  faisca_rt JSONB NOT NULL DEFAULT '{}',
  crs JSONB NOT NULL DEFAULT '{}',
  situacao_central_faisca TEXT NOT NULL DEFAULT '',
  situacao_comunicacao TEXT NOT NULL DEFAULT '',
  situacao_tpepr TEXT NOT NULL DEFAULT '',
  situacao_agentes_extintores TEXT NOT NULL DEFAULT '',
  situacao_equipamentos TEXT NOT NULL DEFAULT '',
  situacao_edificacoes TEXT NOT NULL DEFAULT '',
  inspecoes_tecnicas TEXT NOT NULL DEFAULT '',
  emergencias_aeronauticas TEXT NOT NULL DEFAULT '',
  outras_ocorrencias TEXT NOT NULL DEFAULT '',
  assinatura TEXT NOT NULL DEFAULT ''
);
ALTER TABLE registros_lro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registros_lro_all ON registros_lro;
CREATE POLICY registros_lro_all ON registros_lro FOR ALL USING (true) WITH CHECK (true);

-- 6. Ocorrencias operacionais
CREATE TABLE IF NOT EXISTS ocorrencias_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  tipo_documento TEXT NOT NULL DEFAULT '',
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
  fotos JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE ocorrencias_operacionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ocorrencias_operacionais_all ON ocorrencias_operacionais;
CREATE POLICY ocorrencias_operacionais_all ON ocorrencias_operacionais FOR ALL USING (true) WITH CHECK (true);

-- 7. PTR-BA registros
CREATE TABLE IF NOT EXISTS ptrb_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  hora_inicio TEXT NOT NULL DEFAULT '',
  hora_termino TEXT NOT NULL DEFAULT '',
  duracao TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  participantes JSONB NOT NULL DEFAULT '[]',
  observacoes TEXT NOT NULL DEFAULT '',
  instrutor TEXT NOT NULL DEFAULT '',
  assunto_ministrado TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  informacoes_complementares TEXT NOT NULL DEFAULT '',
  fotos JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE ptrb_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ptrb_registros_all ON ptrb_registros;
CREATE POLICY ptrb_registros_all ON ptrb_registros FOR ALL USING (true) WITH CHECK (true);

-- 8. Substituicoes ativas
CREATE TABLE IF NOT EXISTS substituicoes_ativas (
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
  created_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE substituicoes_ativas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS substituicoes_ativas_all ON substituicoes_ativas;
CREATE POLICY substituicoes_ativas_all ON substituicoes_ativas FOR ALL USING (true) WITH CHECK (true);

-- 9. Certificacoes cursos
CREATE TABLE IF NOT EXISTS certificacoes_cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id TEXT NOT NULL,
  funcionario_nome TEXT NOT NULL DEFAULT '',
  curso_tipo TEXT NOT NULL DEFAULT '',
  curso_nome TEXT NOT NULL DEFAULT '',
  data_emissao TEXT NOT NULL DEFAULT '',
  data_validade TEXT NOT NULL DEFAULT '',
  sem_validade BOOLEAN NOT NULL DEFAULT false,
  empresa TEXT NOT NULL DEFAULT '',
  arquivo TEXT NOT NULL DEFAULT '',
  tipo_arquivo TEXT NOT NULL DEFAULT 'image',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE certificacoes_cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificacoes_cursos_all ON certificacoes_cursos;
CREATE POLICY certificacoes_cursos_all ON certificacoes_cursos FOR ALL USING (true) WITH CHECK (true);

-- 10. Escalas mensais config
CREATE TABLE IF NOT EXISTS escalas_mensais_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe TEXT NOT NULL DEFAULT '',
  mes INTEGER NOT NULL DEFAULT 1,
  ano INTEGER NOT NULL DEFAULT 2026,
  paridade TEXT NOT NULL DEFAULT 'impar',
  pessoas JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE escalas_mensais_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalas_mensais_config_all ON escalas_mensais_config;
CREATE POLICY escalas_mensais_config_all ON escalas_mensais_config FOR ALL USING (true) WITH CHECK (true);

-- 11. Escalas mensais geradas
CREATE TABLE IF NOT EXISTS escalas_mensais_geradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id TEXT NOT NULL DEFAULT '',
  paradas JSONB NOT NULL DEFAULT '[]',
  faxina_mensal JSONB NOT NULL DEFAULT '[]',
  responsabilidades JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE escalas_mensais_geradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalas_mensais_geradas_all ON escalas_mensais_geradas;
CREATE POLICY escalas_mensais_geradas_all ON escalas_mensais_geradas FOR ALL USING (true) WITH CHECK (true);
