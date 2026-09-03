ALTER TABLE agentes_extintores
  ADD COLUMN IF NOT EXISTS marca_agente TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS produto TEXT NOT NULL DEFAULT 'LGE',
  ADD COLUMN IF NOT EXISTS dosagem TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS classe TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade_ensaio_laboratorial TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade_ensaio_fogo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fabricacao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS composicao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS teste_hidrostatico TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade_teste_hidrostatico TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade_cilindro TEXT NOT NULL DEFAULT '';

UPDATE agentes_extintores
SET marca_agente = COALESCE(NULLIF(marca_agente, ''), nome, '')
WHERE marca_agente = '' OR marca_agente IS NULL;

UPDATE agentes_extintores
SET produto = CASE
  WHEN upper(COALESCE(produto, '')) IN ('PQS', 'PO QUIMICO SECO') OR upper(tipo) IN ('PQS', 'PO QUIMICO SECO', 'PÓ QUÍMICO SECO') THEN 'Pó Químico Seco'
  WHEN upper(COALESCE(produto, '')) IN ('NITROGENIO') OR upper(tipo) IN ('NITROGENIO', 'NITROGÊNIO') THEN 'Nitrogênio'
  ELSE 'LGE'
END
WHERE produto = ''
  OR produto IS NULL
  OR upper(produto) IN ('PQS', 'NITROGENIO', 'PO QUIMICO SECO')
  OR tipo IN ('LGE', 'PQS', 'Nitrogenio', 'Nitrogênio', 'CO2', 'Outro', 'Po Quimico Seco', 'Pó Químico Seco');

UPDATE agentes_extintores
SET tipo = CASE produto
  WHEN 'Pó Químico Seco' THEN 'Agente Extintor Complementar'
  WHEN 'Nitrogênio' THEN 'Agente Propelente'
  ELSE 'Agente Extintor Principal'
END
WHERE tipo IN ('LGE', 'PQS', 'Nitrogenio', 'Nitrogênio', 'CO2', 'Outro', 'Po Quimico Seco', 'Pó Químico Seco');

UPDATE agentes_extintores
SET status = CASE
  WHEN status = 'Disponivel' THEN 'Disponível'
  WHEN status = 'Em manutencao' THEN 'Em manutenção'
  ELSE status
END;

CREATE INDEX IF NOT EXISTS idx_agentes_extintores_produto ON agentes_extintores(produto);
