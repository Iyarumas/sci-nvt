ALTER TABLE exercicios_posicionamento
  ADD COLUMN IF NOT EXISTS gerente TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
