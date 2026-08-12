-- Fix RLS: add policies for convites (was locked)
DROP POLICY IF EXISTS convites_all ON convites;
CREATE POLICY convites_all ON convites FOR ALL USING (true) WITH CHECK (true);

-- Fix RLS: add policies for substituicoes_temporarias (was locked)
DROP POLICY IF EXISTS substituicoes_temporarias_all ON substituicoes_temporarias;
CREATE POLICY substituicoes_temporarias_all ON substituicoes_temporarias FOR ALL USING (true) WITH CHECK (true);

-- Create conferencias table (referenced by conferenciaService but missing)
CREATE TABLE IF NOT EXISTS conferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, item_id TEXT NOT NULL, item_nome TEXT NOT NULL DEFAULT '',
  item_numero TEXT NOT NULL DEFAULT '', item_localizacao TEXT NOT NULL DEFAULT '',
  data_conferencia TEXT NOT NULL DEFAULT '', inspetor_username TEXT NOT NULL DEFAULT '',
  inspetor_nome_guerra TEXT NOT NULL DEFAULT '', inspetor_cargo TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '', itens JSONB NOT NULL DEFAULT '[]',
  resultado_final TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
  data_proxima_inspecao TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE conferencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conferencias_all ON conferencias;
CREATE POLICY conferencias_all ON conferencias FOR ALL USING (true) WITH CHECK (true);

-- Create extintores table (referenced by extintorService but missing)
CREATE TABLE IF NOT EXISTS extintores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_serie TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT 'ABC',
  capacidade TEXT NOT NULL DEFAULT '', data_fabricacao TEXT NOT NULL DEFAULT '',
  selo_inmetro TEXT NOT NULL DEFAULT 'Nao', numero_extintor TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Ativo',
  intervalo_conferencia TEXT NOT NULL DEFAULT '6', observacoes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE extintores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS extintores_all ON extintores;
CREATE POLICY extintores_all ON extintores FOR ALL USING (true) WITH CHECK (true);
