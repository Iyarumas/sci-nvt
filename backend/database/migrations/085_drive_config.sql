-- Configuração dos documentos do Google Drive (aba "Validade dos documentos"): prazos em meses,
-- obrigatórios e cargos, Nº padrão por pasta, nomes juntados e documentos adicionados. Uma linha só (id = 1).
CREATE TABLE IF NOT EXISTS drive_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por TEXT
);
