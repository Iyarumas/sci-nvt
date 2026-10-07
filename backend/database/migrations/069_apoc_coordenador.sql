-- A coluna funcao já é TEXT e aceita COORDENADOR sem alteração de schema.
-- Classifica o coordenador existente, preservando seu ID e demais dados.
DO $$
BEGIN
  IF (SELECT count(*) FROM apocs WHERE upper(btrim(nome_completo))
      IN ('RINALDO RACHADEL', 'RINALDO SANTOS RACHADEL')) > 1 THEN
    RAISE EXCEPTION 'Mais de um cadastro do Rinaldo encontrado; revisar antes de classificar o coordenador.';
  END IF;

  UPDATE apocs
  SET funcao = 'COORDENADOR', updated_at = now()
  WHERE upper(btrim(nome_completo)) IN ('RINALDO RACHADEL', 'RINALDO SANTOS RACHADEL')
    AND funcao IN ('APOC', 'SUPERVISOR');
END $$;
