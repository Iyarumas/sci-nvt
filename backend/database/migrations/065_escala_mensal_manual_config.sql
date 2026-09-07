ALTER TABLE escalas_mensais_config
  ADD COLUMN IF NOT EXISTS faxina_manual_modo TEXT,
  ADD COLUMN IF NOT EXISTS faxina_manual JSONB,
  ADD COLUMN IF NOT EXISTS responsabilidades_manual JSONB,
  ADD COLUMN IF NOT EXISTS radio_manual JSONB;
