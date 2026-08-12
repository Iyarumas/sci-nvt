-- =====================================================
-- TABELA DE BOMBEIROS
-- =====================================================

CREATE TABLE IF NOT EXISTS bombeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  nome_guerra TEXT NOT NULL,
  email TEXT NOT NULL,
  data_nascimento TEXT NOT NULL,
  idade INTEGER NOT NULL DEFAULT 0,
  data_admissao TEXT NOT NULL,
  cargo TEXT NOT NULL,
  equipe TEXT NOT NULL,
  turno TEXT NOT NULL,
  tipo_sanguineo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  rg TEXT NOT NULL,
  cnh_numero TEXT NOT NULL DEFAULT '',
  cnh_categoria TEXT NOT NULL DEFAULT '',
  cnh_validade TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  data_desligamento TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  numero_endereco TEXT NOT NULL DEFAULT '',
  complemento TEXT NOT NULL DEFAULT '',
  cep TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT '',
  municipio TEXT NOT NULL DEFAULT '',
  celular TEXT NOT NULL DEFAULT '',
  sexo TEXT NOT NULL DEFAULT 'M',
  curso_chefe_equipe BOOLEAN NOT NULL DEFAULT false,
  curso_motorista_cci BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABELA DE APOCs
-- =====================================================

CREATE TABLE IF NOT EXISTS apocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  nome_guerra TEXT NOT NULL,
  email TEXT NOT NULL,
  funcao TEXT NOT NULL DEFAULT 'APOC',
  equipe TEXT NOT NULL DEFAULT 'MOTIVA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bombeiros_equipe ON bombeiros(equipe);
CREATE INDEX IF NOT EXISTS idx_bombeiros_cargo ON bombeiros(cargo);
CREATE INDEX IF NOT EXISTS idx_bombeiros_cpf ON bombeiros(cpf);
CREATE INDEX IF NOT EXISTS idx_bombeiros_matricula ON bombeiros(matricula);

-- =====================================================
-- RLS (Row Level Security) - Acesso via anon key
-- =====================================================

ALTER TABLE bombeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE apocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bombeiros_all" ON bombeiros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "apocs_all" ON apocs FOR ALL USING (true) WITH CHECK (true);
