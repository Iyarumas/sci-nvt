-- Certificações: o tipo do documento passa a ser lido também do TEXTO do certificado
-- (não só do nome do arquivo). Guardamos o começo do texto (onde fica o título do curso)
-- e a versão da leitura, para reler uma vez os PDFs que foram lidos antes disso.
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS trecho TEXT;
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS versao_leitura INTEGER NOT NULL DEFAULT 1;
