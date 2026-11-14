-- Certificações: o curso também é lido do TEXTO do certificado (não só do nome do arquivo).
-- trecho: começo do texto do PDF (onde fica o título do curso).
-- versao_leitura: para reler uma vez os PDFs lidos antes disso.
-- tipo_informado: certificação a que o administrador vinculou o arquivo quando o nome e o texto não batem
-- (o arquivo no Drive não é renomeado; a tela segue avisando que o nome está fora do padrão).
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS trecho TEXT;
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS versao_leitura INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS tipo_informado TEXT;
ALTER TABLE drive_datas ADD COLUMN IF NOT EXISTS tipo_informado_por TEXT;
