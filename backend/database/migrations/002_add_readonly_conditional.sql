-- Adiciona colunas read_only e conditional_on na tabela document_fields
ALTER TABLE document_fields ADD COLUMN IF NOT EXISTS read_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE document_fields ADD COLUMN IF NOT EXISTS conditional_on TEXT;
