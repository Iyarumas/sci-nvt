import { supabase } from '../lib/supabase';
import type { Conferencia, ItemChecklist } from '../types/conferencia';

const TABLE = 'conferencias';

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

function rowToConferencia(row: Record<string, unknown>): Conferencia {
  return {
    id: row.id as string,
    tipo: row.tipo as Conferencia['tipo'],
    itemId: row.item_id as string,
    itemNome: (row.item_nome as string) || '',
    itemNumero: (row.item_numero as string) || '',
    itemLocalizacao: (row.item_localizacao as string) || '',
    dataConferencia: row.data_conferencia as string,
    inspetorUsername: (row.inspetor_username as string) || '',
    inspetorNomeGuerra: (row.inspetor_nome_guerra as string) || '',
    inspetorCargo: (row.inspetor_cargo as string) || '',
    equipe: row.equipe as Conferencia['equipe'],
    itens: (row.itens as ItemChecklist[]) || [],
    resultadoFinal: row.resultado_final as Conferencia['resultadoFinal'],
    observacoes: (row.observacoes as string) || '',
    dataProximaInspecao: (row.data_proxima_inspecao as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    updatedBy: (row.updated_by as string) || '',
  };
}

function conferenciaToRow(data: Partial<Conferencia>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.itemId !== undefined) row.item_id = data.itemId;
  if (data.itemNome !== undefined) row.item_nome = data.itemNome;
  if (data.itemNumero !== undefined) row.item_numero = data.itemNumero;
  if (data.itemLocalizacao !== undefined) row.item_localizacao = data.itemLocalizacao;
  if (data.dataConferencia !== undefined) row.data_conferencia = data.dataConferencia;
  if (data.inspetorUsername !== undefined) row.inspetor_username = data.inspetorUsername;
  if (data.inspetorNomeGuerra !== undefined) row.inspetor_nome_guerra = data.inspetorNomeGuerra;
  if (data.inspetorCargo !== undefined) row.inspetor_cargo = data.inspetorCargo;
  if (data.equipe !== undefined) row.equipe = data.equipe;
  if (data.itens !== undefined) row.itens = data.itens;
  if (data.resultadoFinal !== undefined) row.resultado_final = data.resultadoFinal;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.dataProximaInspecao !== undefined) row.data_proxima_inspecao = data.dataProximaInspecao;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.updatedBy !== undefined) row.updated_by = data.updatedBy;
  return row;
}

export async function listarConferencias(): Promise<Conferencia[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('data_conferencia', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToConferencia);
}

export async function criarConferencia(data: Omit<Conferencia, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>): Promise<Conferencia> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...conferenciaToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToConferencia(created);
}

export async function atualizarConferencia(id: string, data: Partial<Conferencia>): Promise<Conferencia | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...conferenciaToRow(data), updated_at: now };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToConferencia(updated) : null;
}

export async function excluirConferencia(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
