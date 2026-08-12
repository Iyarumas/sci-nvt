-- Integridade operacional para ferias, substituicoes e escalas.
-- Estes indices protegem contra duplo clique e registros duplicados nos fluxos
-- que alimentam escala diaria, escala anual e documentos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.ferias_escala
     GROUP BY equipe, ano
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'ux_ferias_escala_equipe_ano nao criado: existem duplicidades legadas em ferias_escala.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS ux_ferias_escala_equipe_ano
      ON public.ferias_escala (equipe, ano);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.operational_integrity_violations()
RETURNS TABLE(area TEXT, chave TEXT, total BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'ferias_escala'::TEXT AS area,
    equipe || ':' || ano::TEXT AS chave,
    COUNT(*) AS total
  FROM public.ferias_escala
  GROUP BY equipe, ano
  HAVING COUNT(*) > 1

  UNION ALL

  SELECT
    'ferias_escala_item'::TEXT AS area,
    escala_id::TEXT || ':' || funcionario_id || ':' || periodo_numero::TEXT AS chave,
    COUNT(*) AS total
  FROM public.ferias_escala_item
  WHERE periodo_numero > 0
    AND rejeitado IS NOT TRUE
  GROUP BY escala_id, funcionario_id, periodo_numero
  HAVING COUNT(*) > 1

  UNION ALL

  SELECT
    'ferias'::TEXT AS area,
    funcionario_id || ':' || periodo_numero::TEXT AS chave,
    COUNT(*) AS total
  FROM public.ferias
  WHERE periodo_numero > 0
  GROUP BY funcionario_id, periodo_numero
  HAVING COUNT(*) > 1

  UNION ALL

  SELECT
    'escalas_diarias'::TEXT AS area,
    equipe || ':' || data_plantao AS chave,
    COUNT(*) AS total
  FROM public.escalas_diarias
  GROUP BY equipe, data_plantao
  HAVING COUNT(*) > 1

  UNION ALL

  SELECT
    'substituicoes_temporarias'::TEXT AS area,
    funcionario_id || ':' || substituto_id || ':' || data_inicio || ':' || data_fim || ':' || tipo AS chave,
    COUNT(*) AS total
  FROM public.substituicoes_temporarias
  WHERE status IN ('Pendente', 'Aprovada')
  GROUP BY funcionario_id, substituto_id, data_inicio, data_fim, tipo
  HAVING COUNT(*) > 1;
$$;

GRANT EXECUTE ON FUNCTION public.operational_integrity_violations()
TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.ferias_escala_item
     WHERE periodo_numero > 0
       AND rejeitado IS NOT TRUE
     GROUP BY escala_id, funcionario_id, periodo_numero
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'ux_ferias_escala_item_periodo nao criado: existem duplicidades legadas em ferias_escala_item.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS ux_ferias_escala_item_periodo
      ON public.ferias_escala_item (escala_id, funcionario_id, periodo_numero)
      WHERE periodo_numero > 0 AND rejeitado IS NOT TRUE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.ferias
     WHERE periodo_numero > 0
     GROUP BY funcionario_id, periodo_numero
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'ux_ferias_gozo_funcionario_periodo nao criado: existem duplicidades legadas em ferias.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS ux_ferias_gozo_funcionario_periodo
      ON public.ferias (funcionario_id, periodo_numero)
      WHERE periodo_numero > 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.escalas_diarias
     GROUP BY equipe, data_plantao
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'ux_escalas_diarias_equipe_data nao criado: existem duplicidades legadas em escalas_diarias.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS ux_escalas_diarias_equipe_data
      ON public.escalas_diarias (equipe, data_plantao);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.substituicoes_temporarias
     WHERE status IN ('Pendente', 'Aprovada')
     GROUP BY funcionario_id, substituto_id, data_inicio, data_fim, tipo
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'ux_substituicoes_temporarias_periodo nao criado: existem duplicidades legadas em substituicoes_temporarias.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS ux_substituicoes_temporarias_periodo
      ON public.substituicoes_temporarias (
        funcionario_id,
        substituto_id,
        data_inicio,
        data_fim,
        tipo
      )
      WHERE status IN ('Pendente', 'Aprovada');
  END IF;
END $$;
