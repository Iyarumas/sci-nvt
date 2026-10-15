-- Vínculo das cópias automáticas; documentos históricos permanecem intactos.
ALTER TABLE ptrba_completo_registros
  ADD COLUMN IF NOT EXISTS origem_ptrba_id UUID
    REFERENCES ptrba_completo_registros(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ptrba_apoc_origem
  ON ptrba_completo_registros(origem_ptrba_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ptrba_apoc_origem_valida' AND conrelid = 'ptrba_completo_registros'::regclass) THEN
    ALTER TABLE ptrba_completo_registros ADD CONSTRAINT ptrba_apoc_origem_valida
      CHECK (origem_ptrba_id IS NULL OR (is_apoc = true AND origem_ptrba_id <> id));
  END IF;
END $$;
