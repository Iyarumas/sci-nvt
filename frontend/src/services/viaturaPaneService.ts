import { supabase } from '../lib/supabase';
import type { ViaturaPane, StatusPane } from '../types/viatura';

const TABLE = 'viatura_panes';

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

function rowToPane(row: Record<string, unknown>): ViaturaPane {
  return {
    id: row.id as string,
    viaturaId: (row.viatura_id as string) || '',
    descricao: (row.descricao as string) || '',
    dataRegistro: (row.data_registro as string) || '',
    registradoPor: (row.registrado_por as string) || '',
    status: (row.status as StatusPane) || 'Aberta',
    resolvidaEm: (row.resolvida_em as string) || undefined,
    resolvidaPor: (row.resolvida_por as string) || undefined,
    relatoConserto: (row.relato_conserto as string) || undefined,
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function paneToRow(data: Partial<ViaturaPane>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.viaturaId !== undefined) row.viatura_id = data.viaturaId;
  if (data.descricao !== undefined) row.descricao = data.descricao;
  if (data.dataRegistro !== undefined) row.data_registro = data.dataRegistro;
  if (data.registradoPor !== undefined) row.registrado_por = data.registradoPor;
  if (data.status !== undefined) row.status = data.status;
  if (data.resolvidaEm !== undefined) row.resolvida_em = data.resolvidaEm;
  if (data.resolvidaPor !== undefined) row.resolvida_por = data.resolvidaPor;
  if (data.relatoConserto !== undefined) row.relato_conserto = data.relatoConserto;
  return row;
}

export async function listarPanes(viaturaId: string): Promise<ViaturaPane[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('viatura_id', viaturaId)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToPane);
}

export async function listarTodasPanes(): Promise<ViaturaPane[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToPane);
}

export async function criarPane(data: Omit<ViaturaPane, 'id' | 'createdAt' | 'updatedAt'>): Promise<ViaturaPane> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...paneToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToPane(created);
}

export async function atualizarPane(id: string, updates: Partial<ViaturaPane>): Promise<ViaturaPane> {
  const db = getDb();
  const row = { ...paneToRow(updates), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToPane(updated);
}

export async function excluirPane(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
