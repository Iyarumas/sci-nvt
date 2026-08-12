-- =====================================================
-- SESCINC-MANAGER: Fix schema mismatches verified against live DB
-- Tested via INSERT against actual Supabase project on 2026-07-20
-- =====================================================

-- =====================================================
-- 1. ferias_escala_item: enviado column (migration 020 not applied)
--    Service in feriasService.ts expects `enviado` column for item approval
--    But the database DOES NOT have this column (verified via INSERT failure)
--    These columns existed manually in the original Supabase project, but must
--    be created explicitly for a fresh PostgreSQL database.
-- =====================================================
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS periodo_numero INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS rejeitado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT NOT NULL DEFAULT '';
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS rejeitado_por TEXT NOT NULL DEFAULT '';
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS rejeitado_em TEXT NOT NULL DEFAULT '';
ALTER TABLE ferias_escala_item ADD COLUMN IF NOT EXISTS enviado BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 2. substituicoes_temporarias: tipo and plantao_extra columns
--    (migration 019 not applied)
--    Service in substituicaoTemporariaService.ts expects:
--      tipo (default 'Substituição')
--      plantao_extra (default '')
--    These DO NOT exist in the database (verified via INSERT failure)
-- =====================================================
ALTER TABLE substituicoes_temporarias ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Substituição';
ALTER TABLE substituicoes_temporarias ADD COLUMN IF NOT EXISTS plantao_extra TEXT NOT NULL DEFAULT '';

-- =====================================================
-- Summary of missing columns verified against live database:
-- =====================================================
-- Table                    | Column               | Status
-- -------------------------+----------------------+-------------------------------
-- ferias_escala_item       | enviado              | MISSING (migration 020)
-- substituicoes_temporarias| tipo                 | MISSING (migration 019)
-- substituicoes_temporarias| plantao_extra        | MISSING (migration 019)
--
-- All other service columns already exist in the database.
-- Migrations 022+ should be applied in order.
-- =====================================================
