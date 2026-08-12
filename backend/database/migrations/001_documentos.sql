-- =====================================================
-- TABELAS DE DOCUMENTOS
-- =====================================================

-- Tabela principal de documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'operacional',
  template_pdf_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campos dos documentos
CREATE TABLE IF NOT EXISTS document_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  options JSONB,
  order_index INTEGER NOT NULL DEFAULT 0,
  page INTEGER NOT NULL DEFAULT 1,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 150,
  height DOUBLE PRECISION NOT NULL DEFAULT 20,
  font_size DOUBLE PRECISION NOT NULL DEFAULT 10,
  data_source TEXT NOT NULL DEFAULT 'manual',
  is_signature BOOLEAN NOT NULL DEFAULT false,
  signer_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signatários dos documentos
CREATE TABLE IF NOT EXISTS document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preenchimentos
CREATE TABLE IF NOT EXISTS document_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filled_by TEXT,
  filled_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  autentique_document_id TEXT,
  autentique_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_document_fields_document_id ON document_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_document_id ON document_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_document_fills_document_id ON document_fills(document_id);

-- =====================================================
-- RLS (Row Level Security) - Acesso via anon key
-- =====================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_fills ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (anon pode tudo - ajuste conforme necessidade)
CREATE POLICY "documents_all" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "document_fields_all" ON document_fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "document_signers_all" ON document_signers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "document_fills_all" ON document_fills FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- BUCKET DE STORAGE PARA PDFs
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('document-pdfs', 'document-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: acesso total via anon
CREATE POLICY "document_pdfs_all" ON storage.objects
  FOR ALL USING (bucket_id = 'document-pdfs')
  WITH CHECK (bucket_id = 'document-pdfs');
