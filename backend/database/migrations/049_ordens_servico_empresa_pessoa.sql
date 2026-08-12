ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS finalizacao_empresa_pessoa TEXT NOT NULL DEFAULT '';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS manutencao_empresa_pessoa TEXT NOT NULL DEFAULT '';
