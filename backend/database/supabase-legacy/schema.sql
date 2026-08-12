-- =====================================================
-- SCI Bombeiro - Schema para Sistema de Documentos
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Tabela de documentos (templates)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  template_pdf_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de campos dos documentos
CREATE TABLE IF NOT EXISTS document_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN DEFAULT false,
  placeholder TEXT,
  options JSONB,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de signatários dos documentos
CREATE TABLE IF NOT EXISTS document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de preenchimentos (documentos preenchidos)
CREATE TABLE IF NOT EXISTS document_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  filled_by UUID REFERENCES auth.users(id),
  filled_data JSONB NOT NULL,
  status TEXT DEFAULT 'draft',
  autentique_document_id TEXT,
  autentique_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fills ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permite tudo por enquanto - ajuste conforme necessário)
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all on document_fields" ON document_fields FOR ALL USING (true);
CREATE POLICY "Allow all on document_signers" ON document_signers FOR ALL USING (true);
CREATE POLICY "Allow all on document_fills" ON document_fills FOR ALL USING (true);

-- =====================================================
-- DADOS INICIAIS: Documento "Troca de Serviço"
-- =====================================================

INSERT INTO documents (name, description, category) VALUES
('Troca de Serviço', 'Documento para solicitação de troca de serviço entre bombeiros', 'operacional')
ON CONFLICT DO NOTHING;

-- Buscar o ID do documento inserido
DO $$
DECLARE
  doc_id UUID;
BEGIN
  SELECT id INTO doc_id FROM documents WHERE name = 'Troca de Serviço' LIMIT 1;

  -- Inserir campos do documento
  INSERT INTO document_fields (document_id, field_name, field_label, field_type, required, placeholder, order_index) VALUES
  (doc_id, 'bombeiro1_nome', 'Nome do Bombeiro 1', 'text', true, 'Nome completo', 1),
  (doc_id, 'bombeiro1_matricula', 'Matrícula do Bombeiro 1', 'text', true, 'Ex: 00123', 2),
  (doc_id, 'bombeiro1_funcao', 'Função do Bombeiro 1', 'select', true, 'Selecione', 3),
  (doc_id, 'bombeiro2_nome', 'Nome do Bombeiro 2', 'text', true, 'Nome completo', 4),
  (doc_id, 'bombeiro2_matricula', 'Matrícula do Bombeiro 2', 'text', true, 'Ex: 00456', 5),
  (doc_id, 'bombeiro2_funcao', 'Função do Bombeiro 2', 'select', true, 'Selecione', 6),
  (doc_id, 'data_original', 'Data Original do Serviço', 'date', true, 'dd/mm/aaaa', 7),
  (doc_id, 'data_troca', 'Data da Troca', 'date', true, 'dd/mm/aaaa', 8),
  (doc_id, 'motivo', 'Motivo da Troca', 'textarea', true, 'Descreva o motivo', 9),
  (doc_id, 'observacoes', 'Observações', 'textarea', false, 'Observações adicionais', 10);

  -- Atualizar opções dos campos select
  UPDATE document_fields
  SET options = '["Bombeiro", "Cabo", "Sargento", "Tenente", "Capitão"]'::jsonb
  WHERE document_id = doc_id AND field_name IN ('bombeiro1_funcao', 'bombeiro2_funcao');

  -- Inserir signatários
  INSERT INTO document_signers (document_id, signer_name, signer_role, order_index, required) VALUES
  (doc_id, 'Bombeiro 1', 'bombeiro1', 1, true),
  (doc_id, 'Bombeiro 2', 'bombeiro2', 2, true),
  (doc_id, 'Chefe de Equipe', 'chefe', 3, true);
END $$;
