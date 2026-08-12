import { supabase } from '../lib/supabase';
import type { Hidrante } from '../types/hidrante';

const TABLE = 'hidrantes';

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

function rowToHidrante(row: Record<string, unknown>): Hidrante {
  return {
    id: row.id as string,
    numero: (row.numero as string) || '',
    tipo: (row.tipo as Hidrante['tipo']) || 'Seco',
    localizacao: (row.localizacao as string) || '',
    pressao: (row.pressao as string) || '',
    status: (row.status as Hidrante['status']) || 'Ativo',
    intervaloConferencia: (row.intervalo_conferencia as Hidrante['intervaloConferencia']) || '6',
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function hidranteToRow(data: Partial<Hidrante>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.numero !== undefined) row.numero = data.numero;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.localizacao !== undefined) row.localizacao = data.localizacao;
  if (data.pressao !== undefined) row.pressao = data.pressao;
  if (data.status !== undefined) row.status = data.status;
  if (data.intervaloConferencia !== undefined) row.intervalo_conferencia = data.intervaloConferencia;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export async function listarHidrantes(): Promise<Hidrante[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToHidrante);
}

export async function criarHidrante(data: Omit<Hidrante, 'id' | 'createdAt' | 'updatedAt'>): Promise<Hidrante> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...hidranteToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToHidrante(created);
}

export async function atualizarHidrante(id: string, data: Partial<Hidrante>): Promise<Hidrante> {
  const db = getDb();
  const row = { ...hidranteToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToHidrante(updated);
}

export async function excluirHidrante(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
