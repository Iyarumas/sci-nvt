-- Garante um documento LRO com source_module = 'lro' para arquivamento
INSERT INTO documents (name, description, category, source_module, active, created_at, updated_at)
SELECT 'LIVRO ATA DE CHEFE DE EQUIPE', 'LRO gerado pelo wizard', 'lro', 'lro', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM documents WHERE source_module = 'lro'
);
