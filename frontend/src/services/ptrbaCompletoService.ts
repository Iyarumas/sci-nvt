import { supabase } from '../lib/supabase';
import {
  normalizarEvidenciasPTRBACompleto,
  normalizarParticipantesPTRBACompleto,
} from '../types/ptrbaCompleto';
import type {
  PTRBACompleto,
  PTRBACompletoEvidencia,
  PTRBACompletoInput,
  PTRBACompletoParticipante,
} from '../types/ptrbaCompleto';

const TABLE = 'ptrba_completo_registros';

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

function rowToPTRBACompleto(row: Record<string, unknown>): PTRBACompleto {
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    data: (row.data as string) || '',
    equipe: (row.equipe as string) || '',
    identificacaoAeroporto: (row.identificacao_aeroporto as string) || '',
    observacoes: (row.observacoes as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    participantes: normalizarParticipantesPTRBACompleto(
      parseJSON<PTRBACompletoParticipante[]>(row.participantes, []),
    ),
    evidencias: normalizarEvidenciasPTRBACompleto(
      parseJSON<PTRBACompletoEvidencia[]>(row.evidencias, []),
    ),
  };
}

function inputToRow(input: Partial<PTRBACompletoInput>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  if (input.data !== undefined) row.data = input.data;
  if (input.equipe !== undefined) row.equipe = input.equipe;
  if (input.identificacaoAeroporto !== undefined) row.identificacao_aeroporto = input.identificacaoAeroporto;
  if (input.observacoes !== undefined) row.observacoes = input.observacoes;
  if (input.chefeEquipe !== undefined) row.chefe_equipe = input.chefeEquipe;
  if (input.participantes !== undefined) row.participantes = normalizarParticipantesPTRBACompleto(input.participantes);
  if (input.evidencias !== undefined) row.evidencias = normalizarEvidenciasPTRBACompleto(input.evidencias);
  return row;
}

export async function listarPTRBACompletos(params?: {
  equipe?: string;
  ano?: string;
  dataGte?: string;
  dataLte?: string;
  createdBy?: string;
}): Promise<PTRBACompleto[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.ano) {
    query = query.gte('data', `${params.ano}-01-01`).lte('data', `${params.ano}-12-31`);
  }
  if (params?.dataGte) query = query.gte('data', params.dataGte);
  if (params?.dataLte) query = query.lte('data', params.dataLte);
  if (params?.createdBy) query = query.eq('created_by', params.createdBy);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToPTRBACompleto);
}

export async function obterPTRBACompleto(id: string): Promise<PTRBACompleto | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToPTRBACompleto(data) : null;
}

export async function criarPTRBACompleto(input: PTRBACompletoInput): Promise<PTRBACompleto> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    ...inputToRow(input),
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToPTRBACompleto(data);
}

export async function atualizarPTRBACompleto(
  id: string,
  input: Partial<PTRBACompletoInput>,
): Promise<PTRBACompleto | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).update(inputToRow(input)).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return data ? rowToPTRBACompleto(data) : null;
}

export async function excluirPTRBACompleto(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
