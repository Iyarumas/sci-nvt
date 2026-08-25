ALTER TABLE bombeiros
  ADD COLUMN IF NOT EXISTS autorizado_registros_diarios BOOLEAN NOT NULL DEFAULT false;
