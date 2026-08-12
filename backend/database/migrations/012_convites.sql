CREATE TABLE IF NOT EXISTS convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  usado BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usado_em TIMESTAMPTZ,
  registrado_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_convites_codigo ON convites (codigo);
