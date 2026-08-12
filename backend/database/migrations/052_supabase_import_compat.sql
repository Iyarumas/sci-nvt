-- Compatibility objects required to import legacy data from the Supabase project.

ALTER TABLE public.bombeiros
ADD COLUMN IF NOT EXISTS curso_cve BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.bona_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::text,
  updated_at TEXT NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'))::text,
  data_turno TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  data_ocorrencia TEXT NOT NULL DEFAULT '',
  hora_ocorrencia TEXT NOT NULL DEFAULT '',
  equipe TEXT NOT NULL DEFAULT '',
  numero_ocorrencia TEXT NOT NULL DEFAULT '',
  bombeiros_envolvidos INTEGER NOT NULL DEFAULT 0,
  area_evento TEXT NOT NULL DEFAULT '',
  tipo_ocorrencia TEXT NOT NULL DEFAULT '',
  bace TEXT NOT NULL DEFAULT '',
  bombeiros JSONB NOT NULL DEFAULT '[]'::jsonb,
  vitimas_fatais INTEGER NOT NULL DEFAULT 0,
  vitimas_feridas INTEGER NOT NULL DEFAULT 0,
  acionamento TEXT NOT NULL DEFAULT '',
  saida TEXT NOT NULL DEFAULT '',
  chegada_local TEXT NOT NULL DEFAULT '',
  termino_ocorrencia TEXT NOT NULL DEFAULT '',
  retorno_sci TEXT NOT NULL DEFAULT '',
  tempo_gasto_atendimento TEXT NOT NULL DEFAULT '',
  descricao_ocorrencia TEXT NOT NULL DEFAULT '',
  descricao_atuacao_equipe TEXT NOT NULL DEFAULT '',
  veiculos_utilizados TEXT NOT NULL DEFAULT '',
  outros_recursos_utilizados TEXT NOT NULL DEFAULT '',
  agua NUMERIC NOT NULL DEFAULT 0,
  pqs NUMERIC NOT NULL DEFAULT 0,
  lge NUMERIC NOT NULL DEFAULT 0
);
