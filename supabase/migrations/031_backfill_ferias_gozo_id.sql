-- Backfill ferias_gozo_id for existing items that have a matching non-Gozadas vacation
UPDATE ferias_escala_item i
SET ferias_gozo_id = g.id
FROM ferias g
WHERE g.funcionario_id = i.funcionario_id
  AND g.periodo_numero = i.periodo_numero
  AND g.status != 'Gozadas'
  AND i.ferias_gozo_id IS NULL;
