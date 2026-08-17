ALTER TABLE public.ocorrencias_operacionais
ADD COLUMN IF NOT EXISTS bona_dados JSONB NOT NULL DEFAULT '{}'::jsonb;
