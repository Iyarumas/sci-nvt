import { supabase } from '../lib/supabase';
import type { Extintor } from '../types/extintor';

const TABLE = 'extintores';

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

function rowToExtintor(row: Record<string, unknown>): Extintor {
  return {
    id: row.id as string,
    numeroSerie: (row.numero_serie as string) || '',
    tipo: (row.tipo as Extintor['tipo']) || 'ABC',
    capacidade: (row.capacidade as string) || '',
    dataFabricacao: (row.data_fabricacao as string) || '',
    seloInmetro: (row.selo_inmetro as Extintor['seloInmetro']) || 'Nao',
    numeroExtintor: (row.numero_extintor as string) || '',
    localizacao: (row.localizacao as string) || '',
    status: (row.status as Extintor['status']) || 'Ativo',
    intervaloConferencia: (row.intervalo_conferencia as Extintor['intervaloConferencia']) || '6',
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function extintorToRow(data: Partial<Extintor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.numeroSerie !== undefined) row.numero_serie = data.numeroSerie;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.capacidade !== undefined) row.capacidade = data.capacidade;
  if (data.dataFabricacao !== undefined) row.data_fabricacao = data.dataFabricacao;
  if (data.seloInmetro !== undefined) row.selo_inmetro = data.seloInmetro;
  if (data.numeroExtintor !== undefined) row.numero_extintor = data.numeroExtintor;
  if (data.localizacao !== undefined) row.localizacao = data.localizacao;
  if (data.status !== undefined) row.status = data.status;
  if (data.intervaloConferencia !== undefined) row.intervalo_conferencia = data.intervaloConferencia;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export async function listarExtintores(): Promise<Extintor[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToExtintor);
}

export async function criarExtintor(data: Omit<Extintor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Extintor> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...extintorToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToExtintor(created);
}

export async function atualizarExtintor(id: string, data: Partial<Extintor>): Promise<Extintor> {
  const db = getDb();
  const row = { ...extintorToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToExtintor(updated);
}

export async function excluirExtintor(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
