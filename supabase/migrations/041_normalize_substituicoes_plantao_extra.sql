-- Normaliza plantao_extra para boolean, pois o service salva Sim/Nao na UI
-- e o banco deve persistir true/false.
DO $$
DECLARE
  column_type TEXT;
BEGIN
  SELECT data_type
    INTO column_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'substituicoes_temporarias'
     AND column_name = 'plantao_extra';

  IF column_type IS NULL THEN
    ALTER TABLE public.substituicoes_temporarias
      ADD COLUMN plantao_extra BOOLEAN NOT NULL DEFAULT false;
  ELSIF column_type <> 'boolean' THEN
    ALTER TABLE public.substituicoes_temporarias
      ALTER COLUMN plantao_extra DROP DEFAULT;

    ALTER TABLE public.substituicoes_temporarias
      ALTER COLUMN plantao_extra TYPE BOOLEAN USING (
        CASE LOWER(COALESCE(plantao_extra::TEXT, ''))
          WHEN 'sim' THEN true
          WHEN 's' THEN true
          WHEN 'true' THEN true
          WHEN 't' THEN true
          WHEN 'yes' THEN true
          WHEN 'y' THEN true
          WHEN '1' THEN true
          ELSE false
        END
      );

    ALTER TABLE public.substituicoes_temporarias
      ALTER COLUMN plantao_extra SET DEFAULT false,
      ALTER COLUMN plantao_extra SET NOT NULL;
  ELSE
    UPDATE public.substituicoes_temporarias
       SET plantao_extra = false
     WHERE plantao_extra IS NULL;

    ALTER TABLE public.substituicoes_temporarias
      ALTER COLUMN plantao_extra SET DEFAULT false,
      ALTER COLUMN plantao_extra SET NOT NULL;
  END IF;
END $$;
