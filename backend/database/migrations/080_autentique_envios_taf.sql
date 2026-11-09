-- Envio para assinatura pelo Autentique também para o TAF (todos os participantes assinam na linha
-- deles; o chefe de equipe e o gestor também assinam no rodapé).
ALTER TABLE autentique_envios DROP CONSTRAINT IF EXISTS autentique_envios_tipo_valido;
ALTER TABLE autentique_envios ADD CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba', 'lro', 'troca', 'tpepr', 'taf'));
