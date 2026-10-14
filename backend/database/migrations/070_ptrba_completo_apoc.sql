-- Distinção documental: históricos continuam normais e contabilizáveis.
-- Reaplicar é seguro; nenhum registro ou evidência é removido.
ALTER TABLE ptrba_completo_registros
  ADD COLUMN IF NOT EXISTS is_apoc BOOLEAN NOT NULL DEFAULT false;
