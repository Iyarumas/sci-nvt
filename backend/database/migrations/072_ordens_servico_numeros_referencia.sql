-- Referencias independentes da numeracao interna da SCI.
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS numero_cliente TEXT NOT NULL DEFAULT '';

-- Recupera numeros de cliente explicitamente identificados nas observacoes,
-- mantendo o texto e numeros ja cadastrados intactos.
UPDATE ordens_servico
SET numero_cliente = btrim((regexp_match(observacoes, '(?:^|\n)Número da ordem do cliente: ([^\r\n]+)'))[1])
WHERE numero_cliente = ''
  AND observacoes ~ '(?:^|\n)Número da ordem do cliente: [^\r\n]+';
