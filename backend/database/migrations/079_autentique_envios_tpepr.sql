-- Envio para assinatura pelo Autentique também para o TP/EPR (chefe de equipe + gerente assinam;
-- os outros participantes só reconhecem).
ALTER TABLE autentique_envios DROP CONSTRAINT IF EXISTS autentique_envios_tipo_valido;
ALTER TABLE autentique_envios ADD CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba', 'lro', 'troca', 'tpepr'));
