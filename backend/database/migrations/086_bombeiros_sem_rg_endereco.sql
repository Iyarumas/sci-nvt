-- Cadastro de bombeiros sem RG e sem endereço (decisão do usuário em 10/11/2026: os campos saíram do
-- formulário e os dados guardados podem ser apagados). Nenhuma visão ou função do banco usa estas colunas.
ALTER TABLE bombeiros
  DROP COLUMN IF EXISTS rg,
  DROP COLUMN IF EXISTS endereco,
  DROP COLUMN IF EXISTS numero_endereco,
  DROP COLUMN IF EXISTS complemento,
  DROP COLUMN IF EXISTS bairro,
  DROP COLUMN IF EXISTS cep,
  DROP COLUMN IF EXISTS uf,
  DROP COLUMN IF EXISTS municipio;
