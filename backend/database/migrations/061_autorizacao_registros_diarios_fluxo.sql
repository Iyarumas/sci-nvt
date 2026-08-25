ALTER TABLE bombeiros
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_status TEXT NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_solicitado_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_solicitado_em TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_decidido_por TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_decidido_em TEXT NOT NULL DEFAULT '';

UPDATE bombeiros
SET autorizacao_registros_diarios_status = 'aprovado'
WHERE autorizado_registros_diarios = true
  AND autorizacao_registros_diarios_status = 'nenhuma';
