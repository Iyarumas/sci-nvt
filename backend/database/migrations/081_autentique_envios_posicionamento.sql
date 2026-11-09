-- Envio para assinatura pelo Autentique também para o Exercício de Posicionamento (motoristas e
-- equipagem assinam na tabela das viaturas; BA-CE e GS assinam no rodapé).
ALTER TABLE autentique_envios DROP CONSTRAINT IF EXISTS autentique_envios_tipo_valido;
ALTER TABLE autentique_envios ADD CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba', 'lro', 'troca', 'tpepr', 'taf', 'posicionamento'));
