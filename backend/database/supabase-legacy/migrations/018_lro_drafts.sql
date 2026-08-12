CREATE TABLE IF NOT EXISTS lro_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe TEXT NOT NULL DEFAULT '',
  data_plantao TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho',
  autentique_doc_id TEXT,
  dados JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 days')
);

ALTER TABLE lro_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lro_drafts_all ON lro_drafts;
CREATE POLICY lro_drafts_all ON lro_drafts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lro_drafts_created_by ON lro_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_lro_drafts_status ON lro_drafts(status);
CREATE INDEX IF NOT EXISTS idx_lro_drafts_expires ON lro_drafts(expires_at);
