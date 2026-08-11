-- Add horas column to ptrb_registros for pre-computed decimal hours
ALTER TABLE ptrb_registros ADD COLUMN IF NOT EXISTS horas numeric NOT NULL DEFAULT 0;

-- Backfill existing records based on duracao
UPDATE ptrb_registros SET horas = 
  CAST(SPLIT_PART(duracao, ':', 1) AS numeric) + 
  CAST(SPLIT_PART(duracao, ':', 2) AS numeric) / 60
WHERE duracao != '' AND duracao IS NOT NULL AND horas = 0;
