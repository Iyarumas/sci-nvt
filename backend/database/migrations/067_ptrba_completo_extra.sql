-- Registros anteriores continuam sendo PTR-BA regular.
ALTER TABLE ptrba_completo_registros
  ADD COLUMN IF NOT EXISTS is_extra BOOLEAN NOT NULL DEFAULT false;
