import { supabase } from '../lib/supabase';
import {
  normalizarParticipantesTPEPR,
  ordenarParticipantesTPEPR,
} from '../types/tpepr';
import type {
  TPEPRInput,
  TPEPRParticipante,
  TreinamentoTPEPR,
} from '../types/tpepr';

const TABLE = 'treinamentos_tpepr';

function getDb() {
  if (!supabase) throw new Error('Supabase nao configurado.');
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

function parseJSON<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed === null || parsed === undefined ? fallback : parsed as T;
    } catch {
      return fallback;
    }
  }
  return value === null || value === undefined ? fallback : value as T;
}

function rowToTPEPR(row: Record<string, unknown>): TreinamentoTPEPR {
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    updatedBy: (row.updated_by as string) || '',
    equipe: (row.equipe as string) || '',
    numero: (row.numero as number) || 0,
    ano: (row.ano as string) || '',
    data: (row.data as string) || '',
    hora: (row.hora as string) || '',
    turno: (row.turno as string) || '',
    observacoes: (row.observacoes as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    participantes: normalizarParticipantesTPEPR(
      parseJSON<TPEPRParticipante[]>(row.participantes, []),
    ),
    status: (row.status as TreinamentoTPEPR['status']) || 'Rascunho',
    aprovadoPor: (row.aprovado_por as string) || '',
    aprovadoPorNome: (row.aprovado_por_nome as string) || '',
    aprovadoEm: (row.aprovado_em as string) || '',
  };
}

function inputToRow(input: Partial<TPEPRInput>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  if (input.updatedBy !== undefined) row.updated_by = input.updatedBy;
  if (input.equipe !== undefined) row.equipe = input.equipe;
  if (input.numero !== undefined) row.numero = input.numero;
  if (input.ano !== undefined) row.ano = input.ano;
  if (input.data !== undefined) row.data = input.data;
  if (input.hora !== undefined) row.hora = input.hora;
  if (input.turno !== undefined) row.turno = input.turno;
  if (input.observacoes !== undefined) row.observacoes = input.observacoes;
  if (input.chefeEquipe !== undefined) row.chefe_equipe = input.chefeEquipe;
  if (input.status !== undefined) row.status = input.status;
  if (input.aprovadoPor !== undefined) row.aprovado_por = input.aprovadoPor;
  if (input.aprovadoPorNome !== undefined) row.aprovado_por_nome = input.aprovadoPorNome;
  if (input.aprovadoEm !== undefined) row.aprovado_em = input.aprovadoEm;
  if (input.participantes !== undefined) {
    row.participantes = JSON.stringify(normalizarParticipantesTPEPR(input.participantes));
  }
  return row;
}

export async function listarTPEPRs(params?: {
  equipe?: string;
  ano?: string;
  dataGte?: string;
  dataLte?: string;
  createdBy?: string;
}): Promise<TreinamentoTPEPR[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.ano) query = query.gte('data', `${params.ano}-01-01`).lte('data', `${params.ano}-12-31`);
  if (params?.dataGte) query = query.gte('data', params.dataGte);
  if (params?.dataLte) query = query.lte('data', params.dataLte);
  if (params?.createdBy) query = query.eq('created_by', params.createdBy);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToTPEPR);
}

export async function obterTPEPR(id: string): Promise<TreinamentoTPEPR | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToTPEPR(data) : null;
}

export async function obterProximoNumeroTPEPR(ano: string): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('numero')
    .eq('ano', ano)
    .order('numero', { ascending: false })
    .limit(1);
  if (error) handleSupabaseError(error);
  return data && data.length > 0 ? ((data[0].numero as number) || 0) + 1 : 1;
}

export async function criarTPEPR(input: TPEPRInput): Promise<TreinamentoTPEPR> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    ...inputToRow({
      ...input,
      participantes: ordenarParticipantesTPEPR(normalizarParticipantesTPEPR(input.participantes)),
    }),
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToTPEPR(data);
}

export async function atualizarTPEPR(
  id: string,
  input: Partial<TPEPRInput>,
): Promise<TreinamentoTPEPR | null> {
  const db = getDb();
  const payload = input.participantes
    ? { ...input, participantes: ordenarParticipantesTPEPR(normalizarParticipantesTPEPR(input.participantes)) }
    : input;
  const { data, error } = await db.from(TABLE).update(inputToRow(payload)).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return data ? rowToTPEPR(data) : null;
}

export async function excluirTPEPR(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
