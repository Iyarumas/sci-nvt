ALTER TABLE convites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE convites
SET expires_at = created_at + INTERVAL '2 hours'
WHERE expires_at IS NULL;
