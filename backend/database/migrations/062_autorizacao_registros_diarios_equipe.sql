ALTER TABLE bombeiros
  ADD COLUMN IF NOT EXISTS autorizacao_registros_diarios_equipe TEXT NOT NULL DEFAULT '';

UPDATE bombeiros
SET autorizacao_registros_diarios_equipe = equipe
WHERE autorizacao_registros_diarios_equipe = ''
  AND autorizacao_registros_diarios_status IN ('pendente', 'aprovado')
  AND equipe IN ('Alfa', 'Bravo', 'Charlie', 'Delta');
