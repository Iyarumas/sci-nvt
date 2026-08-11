-- Fix typo in ferias_escala_item: feirista -> ferista
ALTER TABLE ferias_escala_item RENAME COLUMN feirista_id TO ferista_id;
ALTER TABLE ferias_escala_item RENAME COLUMN feirista_nome TO ferista_nome;

-- Ensure rejeitado columns have proper defaults
ALTER TABLE ferias_escala_item ALTER COLUMN rejeitado SET DEFAULT false;
ALTER TABLE ferias_escala_item ALTER COLUMN motivo_rejeicao SET DEFAULT '';
ALTER TABLE ferias_escala_item ALTER COLUMN rejeitado_por SET DEFAULT '';
ALTER TABLE ferias_escala_item ALTER COLUMN rejeitado_em SET DEFAULT '';
