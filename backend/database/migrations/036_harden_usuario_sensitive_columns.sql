-- Evita que clientes com anon key leiam colunas sensiveis da tabela de usuarios.
-- O app deve consultar apenas as colunas publicas definidas em usuarioService.ts.

REVOKE SELECT ON TABLE public.usuarios FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  name,
  role,
  previous_role,
  person_id,
  person_type,
  created_at,
  updated_at
) ON TABLE public.usuarios TO anon, authenticated;
