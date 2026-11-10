-- Datas dos documentos do Google Drive (tela de Certificações).
-- data_curso / validade: lidas do texto do PDF; data_informada: digitada por alguém quando o PDF não tem
-- texto (foto, digitalização). "modificado" guarda a versão do arquivo lida, para ler de novo se mudar.
CREATE TABLE IF NOT EXISTS drive_datas (
  arquivo_id TEXT PRIMARY KEY,
  modificado TIMESTAMPTZ,
  data_curso DATE,
  validade DATE,
  origem TEXT,
  data_informada DATE,
  informada_por TEXT,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  erro TEXT
);
