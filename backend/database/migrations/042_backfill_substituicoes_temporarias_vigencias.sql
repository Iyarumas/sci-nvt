-- Backfill vigencias para substituicoes temporarias aprovadas antes da geracao
-- automatica no service. Mantem idempotencia por origem (ferias_id = substituicao.id).

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
SELECT
  sub.id::TEXT,
  COALESCE(sub.nome_completo, st.substituto_nome, ''),
  COALESCE(sub.cargo, ''),
  COALESCE(NULLIF(st.funcionario_cargo, ''), f.cargo, ''),
  st.funcionario_id,
  st.funcionario_nome,
  COALESCE(NULLIF(st.funcionario_cargo, ''), f.cargo, ''),
  COALESCE(f.equipe, ''),
  st.data_inicio,
  st.data_fim,
  1,
  'substituicao',
  st.id::TEXT,
  true
FROM public.substituicoes_temporarias st
LEFT JOIN public.bombeiros f ON f.id::TEXT = st.funcionario_id
LEFT JOIN public.bombeiros sub ON sub.id::TEXT = st.substituto_id
WHERE st.status = 'Aprovada'
  AND LOWER(COALESCE(st.tipo, '')) IN ('substituição', 'substituicao')
  AND COALESCE(st.data_fim, '') >= (now() AT TIME ZONE 'America/Sao_Paulo')::DATE::TEXT
  AND COALESCE(st.substituto_id, '') <> ''
  AND COALESCE(st.funcionario_id, '') <> ''
  AND NOT EXISTS (
    SELECT 1
      FROM public.vigencia_substituicoes v
     WHERE v.ferias_id = st.id::TEXT
       AND v.motivo = 'substituicao'
       AND v.substituto_id = st.substituto_id
       AND v.funcionario_original_id = st.funcionario_id
  );

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
SELECT
  sub.id::TEXT,
  COALESCE(sub.nome_completo, st.substituto_nome, ''),
  COALESCE(sub.cargo, ''),
  COALESCE(sub.cargo, ''),
  sub.id::TEXT,
  COALESCE(sub.nome_completo, st.substituto_nome, ''),
  COALESCE(sub.cargo, ''),
  sub.equipe,
  st.data_inicio,
  st.data_fim,
  1,
  'cascata',
  st.id::TEXT,
  true
FROM public.substituicoes_temporarias st
JOIN public.bombeiros f ON f.id::TEXT = st.funcionario_id
JOIN public.bombeiros sub ON sub.id::TEXT = st.substituto_id
WHERE st.status = 'Aprovada'
  AND LOWER(COALESCE(st.tipo, '')) IN ('substituição', 'substituicao')
  AND COALESCE(st.data_fim, '') >= (now() AT TIME ZONE 'America/Sao_Paulo')::DATE::TEXT
  AND COALESCE(sub.equipe, '') <> 'Ferista'
  AND COALESCE(sub.equipe, '') <> COALESCE(f.equipe, '')
  AND NOT EXISTS (
    SELECT 1
      FROM public.vigencia_substituicoes v
     WHERE v.ferias_id = st.id::TEXT
       AND v.motivo = 'cascata'
       AND v.substituto_id = sub.id::TEXT
       AND v.funcionario_original_id = sub.id::TEXT
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
SELECT
  sub.equipe,
  COALESCE(sub.cargo, ''),
  st.data_inicio,
  st.data_fim,
  sub.id::TEXT,
  COALESCE(sub.nome_completo, st.substituto_nome, ''),
  'outra_equipe',
  st.id::TEXT,
  '',
  '',
  false
FROM public.substituicoes_temporarias st
JOIN public.bombeiros f ON f.id::TEXT = st.funcionario_id
JOIN public.bombeiros sub ON sub.id::TEXT = st.substituto_id
WHERE st.status = 'Aprovada'
  AND LOWER(COALESCE(st.tipo, '')) IN ('substituição', 'substituicao')
  AND COALESCE(st.data_fim, '') >= (now() AT TIME ZONE 'America/Sao_Paulo')::DATE::TEXT
  AND COALESCE(sub.equipe, '') <> 'Ferista'
  AND COALESCE(sub.equipe, '') <> COALESCE(f.equipe, '')
  AND NOT EXISTS (
    SELECT 1
      FROM public.vagas_pendentes vp
     WHERE vp.cadeia_ferias_id = st.id::TEXT
       AND vp.funcionario_ausente_id = sub.id::TEXT
       AND vp.motivo = 'outra_equipe'
  );
