import type { APOC } from '../types/apoc';
import { supabase } from '../lib/supabase';

const TABLE = 'apocs';
const PUBLIC_COLUMNS = 'id, nome_completo, nome_guerra, funcao, equipe, created_at, updated_at';

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

function rowToApoc(row: Record<string, unknown>): APOC {
  return {
    id: row.id as string,
    nomeCompleto: row.nome_completo as string,
    nomeGuerra: row.nome_guerra as string,
    email: row.email as string,
    funcao: row.funcao as APOC['funcao'],
    equipe: row.equipe as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToApocPublico(row: Record<string, unknown>): APOC {
  return rowToApoc({
    email: '',
    ...row,
  });
}

export async function listarAPOCs(): Promise<APOC[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToApoc);
}

export async function listarAPOCsPublico(): Promise<APOC[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(PUBLIC_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToApocPublico);
}

export async function buscarAPOC(termo: string): Promise<APOC[]> {
  const t = termo.toLowerCase();
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .or(`nome_completo.ilike.%${t}%,nome_guerra.ilike.%${t}%,email.ilike.%${t}%`);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToApoc);
}

export async function buscarAPOCPublico(termo: string): Promise<APOC[]> {
  const t = termo.toLowerCase();
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(PUBLIC_COLUMNS)
    .or(`nome_completo.ilike.%${t}%,nome_guerra.ilike.%${t}%`);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToApocPublico);
}

export async function criarAPOC(data: Omit<APOC, 'id' | 'createdAt' | 'updatedAt'>): Promise<APOC> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data: created, error } = await db
    .from(TABLE)
    .insert({
      nome_completo: data.nomeCompleto,
      nome_guerra: data.nomeGuerra,
      email: data.email,
      funcao: data.funcao,
      equipe: data.equipe,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return rowToApoc(created);
}

export async function atualizarAPOC(id: string, data: Partial<APOC>): Promise<APOC | null> {
  const db = getDb();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.nomeCompleto !== undefined) row.nome_completo = data.nomeCompleto;
  if (data.nomeGuerra !== undefined) row.nome_guerra = data.nomeGuerra;
  if (data.email !== undefined) row.email = data.email;
  if (data.funcao !== undefined) row.funcao = data.funcao;
  if (data.equipe !== undefined) row.equipe = data.equipe;

  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToApoc(updated) : null;
}

export async function excluirAPOC(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
