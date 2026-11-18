import { supabase } from '../lib/supabase';
import type { PrePreenchimento, TelaPrePreenchimento } from '../types/prePreenchimento';

const TABLE = 'pre_preenchimentos';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado. Verifique as credenciais no arquivo .env');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg =
    err instanceof Error ? err.message :
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) :
    'Erro inesperado no banco de dados';
  throw new Error(msg);
}

function rowToPrePreenchimento(row: Record<string, unknown>): PrePreenchimento {
  return {
    id: row.id as string,
    tela: (row.tela as TelaPrePreenchimento) || 'ocorrencias',
    tipo: (row.tipo as string) || '',
    descricao: (row.descricao as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

type DadosPrePreenchimento = Pick<PrePreenchimento, 'tela' | 'tipo' | 'descricao'>;

function prePreenchimentoToRow(data: Partial<DadosPrePreenchimento>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.tela !== undefined) row.tela = data.tela;
  if (data.tipo !== undefined) row.tipo = data.tipo.trim();
  if (data.descricao !== undefined) row.descricao = data.descricao.trim();
  return row;
}

/** Lista os modelos; com `tela`, só os daquela tela. Ordem alfabética pelo tipo. */
export async function listarPrePreenchimentos(tela?: TelaPrePreenchimento): Promise<PrePreenchimento[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (tela) query = query.eq('tela', tela);
  const { data, error } = await query.order('tipo', { ascending: true });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToPrePreenchimento);
}

export async function criarPrePreenchimento(data: DadosPrePreenchimento, createdBy: string): Promise<PrePreenchimento> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...prePreenchimentoToRow(data), created_by: createdBy, created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToPrePreenchimento(created);
}

export async function atualizarPrePreenchimento(id: string, data: Partial<DadosPrePreenchimento>): Promise<PrePreenchimento> {
  const db = getDb();
  const row = { ...prePreenchimentoToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToPrePreenchimento(updated);
}

export async function excluirPrePreenchimento(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
