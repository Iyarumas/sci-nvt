-- Add cve_validade column to bombeiros table
ALTER TABLE bombeiros ADD COLUMN IF NOT EXISTS cve_validade TEXT NOT NULL DEFAULT '';
