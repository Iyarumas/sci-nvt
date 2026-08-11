import { supabase } from '../lib/supabase';
import type { ChatMensagem } from '../types/chat';

const TABLE = 'chat_mensagens';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
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

function rowToMensagem(row: Record<string, unknown>): ChatMensagem {
  return {
    id: row.id as string,
    de: row.de as string,
    deNome: (row.de_nome as string) || '',
    para: (row.para as string) || null,
    paraNome: (row.para_nome as string) || null,
    texto: (row.texto as string) || '',
    lida: !!row.lida,
    createdAt: (row.created_at as string) || '',
  };
}

export async function listarMensagens(): Promise<ChatMensagem[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToMensagem);
}

export async function mensagensGerais(): Promise<ChatMensagem[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').is('para', null).order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToMensagem);
}

export async function mensagensPrivadas(usuario: string): Promise<ChatMensagem[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').or(`de.eq.${usuario},para.eq.${usuario}`).order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToMensagem);
}

export async function conversaCom(usuario1: string, usuario2: string): Promise<ChatMensagem[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .or(`and(de.eq.${usuario1},para.eq.${usuario2}),and(de.eq.${usuario2},para.eq.${usuario1})`)
    .order('created_at', { ascending: true });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToMensagem);
}

export async function enviarMensagem(data: Omit<ChatMensagem, 'id' | 'createdAt' | 'lida'>): Promise<ChatMensagem> {
  const db = getDb();
  const row = {
    de: data.de,
    de_nome: data.deNome,
    para: data.para || null,
    para_nome: data.paraNome || null,
    texto: data.texto,
    lida: false,
    created_at: new Date().toISOString(),
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToMensagem(created);
}

export async function marcarLida(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).update({ lida: true }).eq('id', id);
  if (error) handleSupabaseError(error);
}

export async function contarNaoLidas(usuario: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db.from(TABLE).select('*', { count: 'exact', head: true }).eq('para', usuario).eq('lida', false);
  if (error) handleSupabaseError(error);
  return count || 0;
}
