-- Atualiza somente a equipe/empresa dos APOCs; preserva suas funcoes e vinculos.
ALTER TABLE apocs ALTER COLUMN equipe SET DEFAULT 'ASUR';

UPDATE apocs
SET equipe = 'ASUR', updated_at = now()
WHERE upper(btrim(equipe)) IN ('MOTIVA', 'CCR');

-- Atualiza somente os modelos editaveis do checklist, preservando os registros
-- operacionais ja preenchidos e os demais itens/valores de cada modelo.
UPDATE checklists
SET itens = jsonb_set(
  itens,
  '{linhas}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN upper(btrim(linha->>'item')) IN (
          'LISTA DE RAMAIS CCR NVT', 'LISTA DE RAMAIS MOTIVA NVT'
        ) THEN jsonb_set(linha, '{item}', to_jsonb('Lista de Ramais ASUR NVT'::text))
        ELSE linha
      END ORDER BY ordem
    )
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(itens->'linhas') = 'array'
        THEN itens->'linhas' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS linhas(linha, ordem)
  )
), updated_at = now()
WHERE itens #>> '{meta,equipe}' = 'MODELO FIXO'
  AND itens #>> '{meta,responsavel}' LIKE 'MODELO:%'
  AND jsonb_typeof(itens->'linhas') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(itens->'linhas') = 'array'
        THEN itens->'linhas' ELSE '[]'::jsonb END
    ) AS linha
    WHERE upper(btrim(linha->>'item')) IN (
      'LISTA DE RAMAIS CCR NVT', 'LISTA DE RAMAIS MOTIVA NVT'
    )
  );
