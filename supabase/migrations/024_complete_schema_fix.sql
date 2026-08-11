-- ============================================================
-- Migration 024: Complete schema fix
-- Adds missing columns and seeds missing users
-- ============================================================

-- 1. Add missing column in bombeiros
ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS credencial_validade TEXT DEFAULT '';

-- 2. Add missing columns in ferias_escala_item
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS enviado BOOLEAN DEFAULT false;

-- 3. Add missing columns in substituicoes_temporarias
ALTER TABLE substituicoes_temporarias ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'substituicao';
ALTER TABLE substituicoes_temporarias ADD COLUMN IF NOT EXISTS plantao_extra BOOLEAN DEFAULT false;

-- 4. Seed desenvolvedor "serra" (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'serra') THEN
    PERFORM criar_usuario_com_hash('serra', 'Serra', 'serra', 'desenvolvedor');
  END IF;
END $$;
