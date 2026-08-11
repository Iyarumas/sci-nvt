import { supabase } from '../lib/supabase';
import type { UserRole } from '../context/AuthContext';

const TABLE = 'usuarios';
const USER_SELECT = 'id,username,name,role,previous_role,person_id,person_type,created_at,updated_at';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado. Verifique as credenciais no arquivo .env');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg =
    err instanceof Error ? err.message :
    err && typeof err === 'object' && 'message' in err ? String((err as any).message) :
    'Erro inesperado no banco de dados';
  throw new Error(msg);
}

export interface Usuario {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  previousRole?: UserRole;
  personId?: string;
  personType?: 'bombeiro' | 'apoc';
  createdAt: string;
  updatedAt: string;
}

function rowToUsuario(row: Record<string, unknown>): Usuario {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    role: row.role as UserRole,
    previousRole: row.previous_role as UserRole | undefined,
    personId: row.person_id as string | undefined,
    personType: row.person_type as 'bombeiro' | 'apoc' | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}


export async function listarUsuarios(): Promise<Usuario[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(USER_SELECT)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToUsuario);
}

export async function buscarUsuarioPorUsername(username: string): Promise<Usuario | null> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(USER_SELECT)
    .eq('username', username)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    handleSupabaseError(error);
  }
  return data ? rowToUsuario(data) : null;
}

export async function verificarSenha(username: string, password: string): Promise<Usuario | null> {
  const db = getDb();
  const { data, error } = await db.rpc('verificar_senha', {
    p_username: username,
    p_password: password,
  });
  if (error) handleSupabaseError(error);
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    role: data.role,
    previousRole: data.previousRole,
    personId: data.personId,
    personType: data.personType,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function criarUsuarioComHash(data: {
  username: string;
  name: string;
  password: string;
  role: UserRole;
  previousRole?: string;
  personId?: string;
  personType?: string;
}): Promise<Usuario | null> {
  try {
    const db = getDb();
    const { data: result, error } = await db.rpc('criar_usuario_com_hash', {
      p_username: data.username,
      p_name: data.name,
      p_password: data.password,
      p_role: data.role,
      p_previous_role: data.previousRole || null,
      p_person_id: data.personId || null,
      p_person_type: data.personType || null,
    });
    if (error) throw error;
    if (!result) return null;
    return {
      id: result.id,
      username: result.username,
      name: result.name,
      role: result.role,
      previousRole: result.previousRole,
      personId: result.personId,
      personType: result.personType,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (err) {
    handleSupabaseError(err);
  }
}

export async function atualizarSenha(username: string, password: string): Promise<boolean> {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('atualizar_senha', {
      p_username: username,
      p_password: password,
    });
    if (error) throw error;
    return !!data;
  } catch {
    return false;
  }
}

export async function criarUsuario(data: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<Usuario> {
  const result = await criarUsuarioComHash({
    username: data.username,
    name: data.name,
    password: data.password,
    role: data.role,
    previousRole: data.previousRole,
    personId: data.personId,
    personType: data.personType,
  });
  if (!result) throw new Error('Erro ao criar usuário');
  return result;
}

export async function atualizarUsuario(username: string, data: Record<string, unknown>): Promise<Usuario | null> {
  const db = getDb();
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.role !== undefined) row.role = data.role;
  if (data.previousRole !== undefined) row.previous_role = data.previousRole;
  if (data.personId !== undefined) row.person_id = data.personId;
  if (data.personType !== undefined) row.person_type = data.personType;
  if (data.username !== undefined) row.username = data.username;
  row.updated_at = new Date().toISOString();
  const { data: updated, error } = await db
    .from(TABLE)
    .update(row)
    .eq('username', username)
    .select(USER_SELECT)
    .single();
  if (error) handleSupabaseError(error);
  return updated ? rowToUsuario(updated) : null;
}

export async function excluirUsuario(username: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('username', username);
  if (error) handleSupabaseError(error);
  return true;
}
