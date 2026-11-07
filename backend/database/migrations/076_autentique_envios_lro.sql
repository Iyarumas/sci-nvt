-- Envio para assinatura pelo Autentique também para o LRO (chefe de equipe + gerente).
ALTER TABLE autentique_envios DROP CONSTRAINT IF EXISTS autentique_envios_tipo_valido;
ALTER TABLE autentique_envios ADD CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba', 'lro'));
