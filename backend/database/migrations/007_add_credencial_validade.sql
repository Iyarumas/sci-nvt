-- Adicionar coluna de validade da credencial na tabela de bombeiros
ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS credencial_validade TEXT NOT NULL DEFAULT '';
