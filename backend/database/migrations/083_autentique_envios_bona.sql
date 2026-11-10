-- Envio para assinatura pelo Autentique também para o BONA (chefe de equipe e, quando participou,
-- o BA-LR assinam; os outros bombeiros envolvidos reconhecem).
ALTER TABLE autentique_envios DROP CONSTRAINT IF EXISTS autentique_envios_tipo_valido;
ALTER TABLE autentique_envios ADD CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba', 'lro', 'troca', 'tpepr', 'taf', 'posicionamento', 'temporesposta', 'bona'));
