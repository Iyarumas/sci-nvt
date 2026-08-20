ALTER TABLE escalas_diarias
  ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.escalas_diarias
  ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '[]'::jsonb;
