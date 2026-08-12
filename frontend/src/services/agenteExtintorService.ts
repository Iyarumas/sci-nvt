import { supabase } from '../lib/supabase';
import type { AgenteExtintor } from '../types/agenteExtintor';

const TABLE = 'agentes_extintores';

function getDb() {
  if (!supabase) throw new Error('Supabase nao configurado. Verifique as credenciais no arquivo .env');
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

function rowToAgenteExtintor(row: Record<string, unknown>): AgenteExtintor {
  return {
    id: row.id as string,
    nome: (row.nome as string) || '',
    tipo: (row.tipo as AgenteExtintor['tipo']) || 'LGE',
    quantidade: Number(row.quantidade || 0),
    unidade: (row.unidade as AgenteExtintor['unidade']) || 'L',
    lote: (row.lote as string) || '',
    validade: (row.validade as string) || '',
    localizacao: (row.localizacao as string) || '',
    status: (row.status as AgenteExtintor['status']) || 'Disponivel',
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function agenteExtintorToRow(data: Partial<AgenteExtintor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.nome !== undefined) row.nome = data.nome;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.quantidade !== undefined) row.quantidade = data.quantidade;
  if (data.unidade !== undefined) row.unidade = data.unidade;
  if (data.lote !== undefined) row.lote = data.lote;
  if (data.validade !== undefined) row.validade = data.validade;
  if (data.localizacao !== undefined) row.localizacao = data.localizacao;
  if (data.status !== undefined) row.status = data.status;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export async function listarAgentesExtintores(): Promise<AgenteExtintor[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToAgenteExtintor);
}

export async function criarAgenteExtintor(
  data: Omit<AgenteExtintor, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<AgenteExtintor> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...agenteExtintorToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToAgenteExtintor(created);
}

export async function atualizarAgenteExtintor(
  id: string,
  data: Partial<AgenteExtintor>,
): Promise<AgenteExtintor> {
  const db = getDb();
  const row = { ...agenteExtintorToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToAgenteExtintor(updated);
}

export async function excluirAgenteExtintor(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
