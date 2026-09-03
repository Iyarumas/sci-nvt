ALTER TABLE agentes_extintores
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Agente Extintor Principal',
  ADD COLUMN IF NOT EXISTS quantidade NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidade TEXT NOT NULL DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS lote TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS localizacao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Disponível',
  ADD COLUMN IF NOT EXISTS observacoes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agentes_extintores'
      AND column_name = 'fabricante'
  ) THEN
    UPDATE agentes_extintores
    SET marca_agente = COALESCE(NULLIF(marca_agente, ''), NULLIF(nome, ''), NULLIF(fabricante, ''), '')
    WHERE COALESCE(marca_agente, '') = '';

    UPDATE agentes_extintores
    SET nome = COALESCE(NULLIF(nome, ''), NULLIF(marca_agente, ''), NULLIF(fabricante, ''), '')
    WHERE COALESCE(nome, '') = '';
  ELSE
    UPDATE agentes_extintores
    SET marca_agente = COALESCE(NULLIF(marca_agente, ''), NULLIF(nome, ''), '')
    WHERE COALESCE(marca_agente, '') = '';

    UPDATE agentes_extintores
    SET nome = COALESCE(NULLIF(nome, ''), NULLIF(marca_agente, ''), '')
    WHERE COALESCE(nome, '') = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agentes_extintores'
      AND column_name = 'tipo_agente'
  ) THEN
    UPDATE agentes_extintores
    SET produto = CASE
      WHEN upper(COALESCE(produto, '')) IN ('PQS', 'PO QUIMICO SECO', 'PÓ QUÍMICO SECO')
        OR upper(COALESCE(tipo_agente, '')) IN ('PQS', 'PO QUIMICO SECO', 'PÓ QUÍMICO SECO')
        THEN 'Pó Químico Seco'
      WHEN upper(COALESCE(produto, '')) IN ('NITROGENIO', 'NITROGÊNIO')
        OR upper(COALESCE(tipo_agente, '')) IN ('NITROGENIO', 'NITROGÊNIO')
        THEN 'Nitrogênio'
      ELSE 'LGE'
    END
    WHERE COALESCE(produto, '') = ''
      OR upper(produto) IN ('PQS', 'NITROGENIO', 'PO QUIMICO SECO');
  END IF;

  UPDATE agentes_extintores
  SET tipo = CASE produto
    WHEN 'Pó Químico Seco' THEN 'Agente Extintor Complementar'
    WHEN 'Nitrogênio' THEN 'Agente Propelente'
    ELSE 'Agente Extintor Principal'
  END
  WHERE COALESCE(tipo, '') = ''
    OR tipo IN ('LGE', 'PQS', 'Nitrogenio', 'Nitrogênio', 'CO2', 'Outro', 'Po Quimico Seco', 'Pó Químico Seco');

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agentes_extintores'
      AND column_name = 'data_validade'
  ) THEN
    UPDATE agentes_extintores
    SET validade = COALESCE(NULLIF(validade, ''), NULLIF(data_validade, ''), '')
    WHERE COALESCE(validade, '') = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agentes_extintores'
      AND column_name = 'situacao'
  ) THEN
    UPDATE agentes_extintores
    SET status = CASE
      WHEN upper(COALESCE(situacao, '')) IN ('VALIDO', 'VÁLIDO', 'DISPONIVEL', 'DISPONÍVEL') THEN 'Disponível'
      WHEN upper(COALESCE(situacao, '')) IN ('VENCIDO') THEN 'Vencido'
      WHEN upper(COALESCE(situacao, '')) IN ('MANUTENCAO', 'MANUTENÇÃO', 'EM MANUTENCAO', 'EM MANUTENÇÃO') THEN 'Em manutenção'
      ELSE COALESCE(NULLIF(status, ''), 'Disponível')
    END
    WHERE COALESCE(status, '') = ''
      OR status IN ('Disponivel', 'Valido', 'Válido');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agentes_extintores_produto ON agentes_extintores(produto);
CREATE INDEX IF NOT EXISTS idx_agentes_extintores_tipo ON agentes_extintores(tipo);
CREATE INDEX IF NOT EXISTS idx_agentes_extintores_status ON agentes_extintores(status);
