import { supabase } from '../lib/supabase';
import type { SubstituicaoAtiva } from '../types/ferias';

const TABLE = 'substituicoes_ativas';

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

function rowToSubstituicao(row: Record<string, unknown>): SubstituicaoAtiva {
  return {
    id: row.id as string,
    feriasId: (row.ferias_id as string) || '',
    funcionarioId: (row.funcionario_id as string) || '',
    funcionarioNome: (row.funcionario_nome as string) || '',
    substitutoId: (row.substituto_id as string) || '',
    substitutoNome: (row.substituto_nome as string) || '',
    funcaoSubstituicao: (row.funcao_substituicao as SubstituicaoAtiva['funcaoSubstituicao']) || 'BA-2',
    dataInicio: (row.data_inicio as string) || '',
    dataFim: (row.data_fim as string) || '',
    ativa: row.ativa !== false,
    createdAt: (row.created_at as string) || '',
  };
}

export async function listarSubstituicoes(): Promise<SubstituicaoAtiva[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*');
  if (error) throw error;
  return (data || []).map(rowToSubstituicao);
}

export async function substituicoesAtivas(): Promise<SubstituicaoAtiva[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('ativa', true);
  if (error) throw error;
  return (data || []).map(rowToSubstituicao);
}

export async function substituicaoPorSubstituto(substitutoId: string): Promise<SubstituicaoAtiva | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('substituto_id', substitutoId).eq('ativa', true).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToSubstituicao(data) : null;
}

export async function substituicaoPorFuncionario(funcionarioId: string): Promise<SubstituicaoAtiva | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('funcionario_id', funcionarioId).eq('ativa', true).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToSubstituicao(data) : null;
}

export async function criarSubstituicao(data: {
  feriasId: string;
  funcionarioId: string;
  funcionarioNome: string;
  substitutoId: string;
  substitutoNome: string;
  funcaoSubstituicao: string;
  dataInicio: string;
  dataFim: string;
}): Promise<SubstituicaoAtiva> {
  const db = getDb();
  const row = {
    ferias_id: data.feriasId,
    funcionario_id: data.funcionarioId,
    funcionario_nome: data.funcionarioNome,
    substituto_id: data.substitutoId,
    substituto_nome: data.substitutoNome,
    funcao_substituicao: data.funcaoSubstituicao,
    data_inicio: data.dataInicio,
    data_fim: data.dataFim,
    ativa: true,
    created_at: new Date().toISOString(),
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToSubstituicao(created);
}

export async function encerrarSubstituicao(id: string): Promise<SubstituicaoAtiva | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).update({ ativa: false }).eq('id', id).select().single();
  if (error) throw error;
  return data ? rowToSubstituicao(data) : null;
}

export async function excluirSubstituicao(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}
