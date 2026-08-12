-- =====================================================
-- Migration 027: Add bairro column to bombeiros table
-- =====================================================

ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS bairro TEXT NOT NULL DEFAULT '';
