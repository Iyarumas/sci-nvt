-- Aprova escala anual de ferias e gera gozos/vigencias em uma transacao.
-- A funcao e chamada pelo app quando existir no banco; caso contrario o
-- feriasService mantem o fluxo client-side como fallback.

CREATE OR REPLACE FUNCTION public.aprovar_escala_ferias_transacional(
  p_escala_id UUID,
  p_aprovado_por TEXT,
  p_aprovado_por_nome TEXT,
  p_manter_status BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escala public.ferias_escala%ROWTYPE;
  v_item public.ferias_escala_item%ROWTYPE;
  v_gozo_id UUID;
  v_sub RECORD;
  v_func RECORD;
  v_cadeia JSONB;
  v_elo JSONB;
  v_prev_id TEXT;
  v_prev_nome TEXT;
  v_nivel INTEGER;
  v_criados INTEGER := 0;
  v_vinculados INTEGER := 0;
BEGIN
  SELECT *
    INTO v_escala
    FROM public.ferias_escala
   WHERE id = p_escala_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala de ferias nao encontrada: %', p_escala_id;
  END IF;

  FOR v_item IN
    SELECT *
      FROM public.ferias_escala_item
     WHERE escala_id = p_escala_id
       AND enviado IS TRUE
       AND rejeitado IS NOT TRUE
     ORDER BY mes ASC, created_at ASC
  LOOP
    SELECT id
      INTO v_gozo_id
      FROM public.ferias
     WHERE funcionario_id = v_item.funcionario_id
       AND periodo_numero = v_item.periodo_numero
     LIMIT 1;

    IF v_gozo_id IS NULL THEN
      IF COALESCE(v_item.funcionario_id, '') = '' THEN
        RAISE EXCEPTION 'Item de escala sem funcionario: %', v_item.id;
      END IF;
      IF COALESCE(v_item.data_inicio, '') = '' OR COALESCE(v_item.data_fim, '') = '' THEN
        RAISE EXCEPTION 'Item de escala sem periodo valido: %', v_item.id;
      END IF;

      INSERT INTO public.ferias (
        funcionario_id,
        funcionario_nome,
        equipe,
        periodo_numero,
        data_inicio,
        data_fim,
        dias,
        status,
        substituto_id,
        substituto_nome,
        funcao_substituicao,
        observacoes,
        modificado_por,
        bloqueado,
        created_at,
        updated_at
      )
      VALUES (
        v_item.funcionario_id,
        v_item.funcionario_nome,
        v_escala.equipe,
        v_item.periodo_numero,
        v_item.data_inicio,
        v_item.data_fim,
        v_item.dias,
        'Programadas',
        v_item.substituto_id,
        v_item.substituto_nome,
        v_item.funcao_substituicao,
        CASE WHEN COALESCE(v_item.ferista_nome, '') <> '' THEN 'Ferista: ' || v_item.ferista_nome ELSE '' END,
        p_aprovado_por,
        false,
        now(),
        now()
      )
      RETURNING id INTO v_gozo_id;

      v_criados := v_criados + 1;

      IF COALESCE(v_item.substituto_id, '') <> '' THEN
        SELECT id::TEXT AS id, nome_completo, cargo, equipe
          INTO v_sub
          FROM public.bombeiros
         WHERE id::TEXT = v_item.substituto_id
         LIMIT 1;

        SELECT id::TEXT AS id, nome_completo, cargo, equipe
          INTO v_func
          FROM public.bombeiros
         WHERE id::TEXT = v_item.funcionario_id
         LIMIT 1;

        IF COALESCE(v_sub.id, '') = '' THEN
          RAISE EXCEPTION 'Substituto nao encontrado para item %', v_item.id;
        END IF;

        DELETE FROM public.vigencia_substituicoes
         WHERE ferias_id = v_gozo_id::TEXT;

        INSERT INTO public.vigencia_substituicoes (
          substituto_id,
          substituto_nome,
          cargo_original_substituto,
          cargo_exercido,
          funcionario_original_id,
          funcionario_original_nome,
          cargo_original_funcionario,
          equipe,
          data_inicio,
          data_fim,
          nivel_cascata,
          motivo,
          ferias_id,
          ativa
        )
        VALUES (
          v_sub.id,
          COALESCE(v_sub.nome_completo, v_item.substituto_nome),
          COALESCE(v_sub.cargo, ''),
          COALESCE(NULLIF(v_item.funcao_substituicao, ''), NULLIF(v_item.funcao, ''), COALESCE(v_func.cargo, '')),
          v_item.funcionario_id,
          v_item.funcionario_nome,
          COALESCE(NULLIF(v_item.funcao_substituicao, ''), NULLIF(v_item.funcao, ''), COALESCE(v_func.cargo, '')),
          v_escala.equipe,
          v_item.data_inicio,
          v_item.data_fim,
          1,
          'ferias',
          v_gozo_id::TEXT,
          true
        );

        IF COALESCE(v_sub.equipe, '') <> 'Ferista' AND COALESCE(v_sub.equipe, '') <> v_escala.equipe THEN
          INSERT INTO public.vigencia_substituicoes (
            substituto_id,
            substituto_nome,
            cargo_original_substituto,
            cargo_exercido,
            funcionario_original_id,
            funcionario_original_nome,
            cargo_original_funcionario,
            equipe,
            data_inicio,
            data_fim,
            nivel_cascata,
            motivo,
            ferias_id,
            ativa
          )
          VALUES (
            v_sub.id,
            COALESCE(v_sub.nome_completo, v_item.substituto_nome),
            COALESCE(v_sub.cargo, ''),
            COALESCE(v_sub.cargo, ''),
            v_sub.id,
            COALESCE(v_sub.nome_completo, v_item.substituto_nome),
            COALESCE(v_sub.cargo, ''),
            v_sub.equipe,
            v_item.data_inicio,
            v_item.data_fim,
            1,
            'cascata',
            v_gozo_id::TEXT,
            true
          );

          INSERT INTO public.vagas_pendentes (
            equipe,
            cargo,
            data_inicio,
            data_fim,
            funcionario_ausente_id,
            funcionario_ausente_nome,
            motivo,
            cadeia_ferias_id,
            preenchido_por_id,
            preenchido_por_nome,
            resolvido
          )
          VALUES (
            v_sub.equipe,
            COALESCE(v_sub.cargo, ''),
            v_item.data_inicio,
            v_item.data_fim,
            v_sub.id,
            COALESCE(v_sub.nome_completo, v_item.substituto_nome),
            'outra_equipe',
            v_gozo_id::TEXT,
            '',
            '',
            false
          );
        END IF;

        v_cadeia := '[]'::JSONB;
        IF COALESCE(v_item.observacoes, '') LIKE 'cad_sup:%' THEN
          v_cadeia := SUBSTRING(v_item.observacoes FROM 9)::JSONB;
        END IF;

        v_prev_id := v_item.substituto_id;
        v_prev_nome := v_item.substituto_nome;
        v_nivel := 2;

        FOR v_elo IN SELECT value FROM jsonb_array_elements(v_cadeia)
        LOOP
          INSERT INTO public.vigencia_substituicoes (
            substituto_id,
            substituto_nome,
            cargo_original_substituto,
            cargo_exercido,
            funcionario_original_id,
            funcionario_original_nome,
            cargo_original_funcionario,
            equipe,
            data_inicio,
            data_fim,
            nivel_cascata,
            motivo,
            ferias_id,
            ativa
          )
          VALUES (
            COALESCE(v_elo->>'pessoaId', ''),
            COALESCE(v_elo->>'pessoaNome', ''),
            COALESCE(v_elo->>'pessoaCargo', ''),
            COALESCE(v_elo->>'cargoVacante', ''),
            COALESCE(v_prev_id, ''),
            COALESCE(v_elo->>'substituindoNome', v_prev_nome, ''),
            COALESCE(v_elo->>'cargoVacante', ''),
            v_escala.equipe,
            v_item.data_inicio,
            v_item.data_fim,
            v_nivel,
            'cascata',
            v_gozo_id::TEXT,
            true
          );

          v_prev_id := COALESCE(v_elo->>'pessoaId', '');
          v_prev_nome := COALESCE(v_elo->>'pessoaNome', '');
          v_nivel := v_nivel + 1;
        END LOOP;
      END IF;
    END IF;

    UPDATE public.ferias_escala_item
       SET ferias_gozo_id = v_gozo_id
     WHERE id = v_item.id
       AND ferias_gozo_id IS DISTINCT FROM v_gozo_id;

    v_vinculados := v_vinculados + 1;
  END LOOP;

  IF NOT p_manter_status THEN
    UPDATE public.ferias_escala
       SET status = 'Aprovado',
           aprovado_por = p_aprovado_por,
           aprovado_por_nome = p_aprovado_por_nome,
           aprovado_em = now()::TEXT,
           updated_at = now()
     WHERE id = p_escala_id;
  END IF;

  RETURN jsonb_build_object(
    'escalaId', p_escala_id,
    'gozosCriados', v_criados,
    'itensVinculados', v_vinculados,
    'statusAtualizado', NOT p_manter_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_escala_ferias_transacional(UUID, TEXT, TEXT, BOOLEAN)
TO anon, authenticated;
