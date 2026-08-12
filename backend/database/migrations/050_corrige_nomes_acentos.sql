-- 050: Corrige nomes gravados com maiusculas indevidas apos acentos
--
-- Causa: o capitalize JS usava /\b\w/g, que em regex trata letras acentuadas
-- como nao-palavra. Em "Joao", o acento criava uma fronteira de palavra e o
-- regex capitalizava a letra seguinte -> "JoãO".
--
-- Correcao: normaliza nome proprio - primeira letra de cada palavra em
-- maiuscula (apos espaco, hifen, apostrofo, ponto ou parentese), restante
-- em minuscula.

CREATE OR REPLACE FUNCTION public.capitalizar_nome_proprio(nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  anterior text := ' ';
  saida text := '';
  c text;
BEGIN
  IF nome IS NULL THEN
    RETURN NULL;
  END IF;

  FOR c IN SELECT unnest(string_to_array(lower(nome), NULL))
  LOOP
    IF anterior ~ E'^[ \\-''.()]$' THEN
      saida := saida || upper(c);
    ELSE
      saida := saida || c;
    END IF;
    anterior := c;
  END LOOP;

  RETURN saida;
END;
$$;

UPDATE bombeiros
SET nome_completo = public.capitalizar_nome_proprio(nome_completo),
    nome_guerra = public.capitalizar_nome_proprio(nome_guerra);

UPDATE apocs
SET nome_completo = public.capitalizar_nome_proprio(nome_completo),
    nome_guerra = public.capitalizar_nome_proprio(nome_guerra);

UPDATE viaturas
SET marca = public.capitalizar_nome_proprio(marca),
    modelo = public.capitalizar_nome_proprio(modelo);
