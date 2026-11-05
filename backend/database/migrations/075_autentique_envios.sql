-- Envios de documentos para assinatura eletronica (Autentique).
-- Um documento sem envio ativo e um rascunho: pode ser editado e excluido.
-- Com envio aguardando, assinado ou recusado, o documento fica bloqueado.
CREATE TABLE IF NOT EXISTS autentique_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  referencia_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  autentique_document_id TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  pdf_assinado_url TEXT,
  enviado_por_id TEXT NOT NULL DEFAULT '',
  enviado_por_nome TEXT NOT NULL DEFAULT '',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_por_nome TEXT NOT NULL DEFAULT '',
  CONSTRAINT autentique_envios_tipo_valido CHECK (tipo IN ('ptrba')),
  CONSTRAINT autentique_envios_status_valido CHECK (status IN ('aguardando', 'assinado', 'recusado', 'cancelado'))
);

-- So pode existir um envio ativo por documento.
CREATE UNIQUE INDEX IF NOT EXISTS idx_autentique_envios_ativo
  ON autentique_envios (tipo, referencia_id)
  WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_autentique_envios_referencia ON autentique_envios (tipo, referencia_id);

CREATE TABLE IF NOT EXISTS autentique_signatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID NOT NULL REFERENCES autentique_envios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  funcoes TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  celular TEXT NOT NULL DEFAULT '',
  autentique_signature_id TEXT,
  link TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  assinado_em TIMESTAMPTZ,
  recusado_em TIMESTAMPTZ,
  CONSTRAINT autentique_signatarios_status_valido CHECK (status IN ('pendente', 'assinado', 'recusado'))
);

CREATE INDEX IF NOT EXISTS idx_autentique_signatarios_envio ON autentique_signatarios (envio_id);
