-- Adiciona coluna source_module para vincular documento a um modulo
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_module TEXT;

-- Atualiza o documento de troca existente
UPDATE documents SET source_module = 'trocas' WHERE name ILIKE '%troca%';
