-- Adiciona coluna expires_at para controle de validade dos convites
ALTER TABLE convites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
