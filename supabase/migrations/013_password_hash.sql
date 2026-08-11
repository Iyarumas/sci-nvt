CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;

CREATE OR REPLACE FUNCTION verificar_senha(p_username TEXT, p_password TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_user FROM usuarios WHERE username = p_username;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_user.senha_hash IS NOT NULL THEN
    IF v_user.senha_hash = crypt(p_password, v_user.senha_hash) THEN
      v_result := jsonb_build_object('id', v_user.id, 'username', v_user.username, 'name', v_user.name, 'role', v_user.role, 'previousRole', v_user.previous_role, 'personId', v_user.person_id, 'personType', v_user.person_type, 'createdAt', v_user.created_at, 'updatedAt', v_user.updated_at);
      RETURN v_result;
    END IF;
    RETURN NULL;
  END IF;
  IF v_user.password = p_password THEN
    UPDATE usuarios SET senha_hash = crypt(p_password, gen_salt('bf')), password = '', updated_at = now() WHERE username = p_username;
    v_result := jsonb_build_object('id', v_user.id, 'username', v_user.username, 'name', v_user.name, 'role', v_user.role, 'previousRole', v_user.previous_role, 'personId', v_user.person_id, 'personType', v_user.person_type, 'createdAt', v_user.created_at, 'updatedAt', now());
    RETURN v_result;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION criar_usuario_com_hash(
  p_username TEXT, p_name TEXT, p_password TEXT, p_role TEXT,
  p_previous_role TEXT DEFAULT NULL,
  p_person_id UUID DEFAULT NULL,
  p_person_type TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_result JSONB;
BEGIN
  INSERT INTO usuarios (username, name, password, role, previous_role, person_id, person_type, senha_hash)
  VALUES (p_username, p_name, '', p_role, p_previous_role, p_person_id, p_person_type, crypt(p_password, gen_salt('bf')))
  RETURNING * INTO v_user;
  v_result := jsonb_build_object('id', v_user.id, 'username', v_user.username, 'name', v_user.name, 'role', v_user.role, 'previousRole', v_user.previous_role, 'personId', v_user.person_id, 'personType', v_user.person_type, 'createdAt', v_user.created_at, 'updatedAt', v_user.updated_at);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION atualizar_senha(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE usuarios SET senha_hash = crypt(p_password, gen_salt('bf')), password = '', updated_at = now() WHERE username = p_username;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION migrar_senhas_existentes()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_errors TEXT := '';
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT * FROM usuarios WHERE senha_hash IS NULL AND password != '' LOOP
    BEGIN
      UPDATE usuarios SET senha_hash = crypt(v_user.password, gen_salt('bf')), password = '', updated_at = now() WHERE id = v_user.id;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || 'Erro ao migrar ' || v_user.username || ': ' || SQLERRM || E'\n';
    END;
  END LOOP;
  SELECT COUNT(*) INTO v_count FROM usuarios WHERE senha_hash IS NOT NULL;
  RETURN v_count || ' usuários migrados. Erros: ' || COALESCE(v_errors, 'Nenhum');
END;
$$;

GRANT EXECUTE ON FUNCTION verificar_senha TO anon, authenticated;
GRANT EXECUTE ON FUNCTION criar_usuario_com_hash TO anon, authenticated;
GRANT EXECUTE ON FUNCTION atualizar_senha TO anon, authenticated;
GRANT EXECUTE ON FUNCTION migrar_senhas_existentes TO anon, authenticated;
