-- Adiciona relato do conserto na tabela de panes de viaturas
ALTER TABLE viatura_panes ADD COLUMN IF NOT EXISTS relato_conserto TEXT DEFAULT '';
