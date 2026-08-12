ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by TEXT;

UPDATE documents SET created_by = 'admin_master' WHERE created_by IS NULL;
