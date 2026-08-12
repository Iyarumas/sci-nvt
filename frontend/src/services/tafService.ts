import { supabase } from '../lib/supabase';
import type { TreinamentoTAF } from '../types/taf';

const TABLE = 'treinamentos_taf';

function getDb() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase; }
function handleSupabaseError(err: unknown): never { console.error('Erro Supabase:', err); throw new Error(err instanceof Error ? err.message : 'Erro inesperado'); }

function rowToItem(row: Record<string, unknown>): TreinamentoTAF {
  return {
    id: row.id as string, equipe: (row.equipe as string) || '', numero: (row.numero as number) || 0, ano: (row.ano as string) || '',
    data: (row.data as string) || '', hora: (row.hora as string) || '', turno: (row.turno as string) || '', tipoTaf: (row.tipo_taf as string) || '',
    p1Nome: (row.p1_nome as string) || '', p1Funcao: (row.p1_funcao as string) || '', p1Idade: (row.p1_idade as number) || 0, p1Tempo: (row.p1_tempo as string) || '',
    p2Nome: (row.p2_nome as string) || '', p2Funcao: (row.p2_funcao as string) || '', p2Idade: (row.p2_idade as number) || 0, p2Tempo: (row.p2_tempo as string) || '',
    p3Nome: (row.p3_nome as string) || '', p3Funcao: (row.p3_funcao as string) || '', p3Idade: (row.p3_idade as number) || 0, p3Tempo: (row.p3_tempo as string) || '',
    p4Nome: (row.p4_nome as string) || '', p4Funcao: (row.p4_funcao as string) || '', p4Idade: (row.p4_idade as number) || 0, p4Tempo: (row.p4_tempo as string) || '',
    p5Nome: (row.p5_nome as string) || '', p5Funcao: (row.p5_funcao as string) || '', p5Idade: (row.p5_idade as number) || 0, p5Tempo: (row.p5_tempo as string) || '',
    p6Nome: (row.p6_nome as string) || '', p6Funcao: (row.p6_funcao as string) || '', p6Idade: (row.p6_idade as number) || 0, p6Tempo: (row.p6_tempo as string) || '',
    p7Nome: (row.p7_nome as string) || '', p7Funcao: (row.p7_funcao as string) || '', p7Idade: (row.p7_idade as number) || 0, p7Tempo: (row.p7_tempo as string) || '',
    p8Nome: (row.p8_nome as string) || '', p8Funcao: (row.p8_funcao as string) || '', p8Idade: (row.p8_idade as number) || 0, p8Tempo: (row.p8_tempo as string) || '',
    p9Nome: (row.p9_nome as string) || '', p9Funcao: (row.p9_funcao as string) || '', p9Idade: (row.p9_idade as number) || 0, p9Tempo: (row.p9_tempo as string) || '',
    p10Nome: (row.p10_nome as string) || '', p10Funcao: (row.p10_funcao as string) || '', p10Idade: (row.p10_idade as number) || 0, p10Tempo: (row.p10_tempo as string) || '',
    observacoes: (row.observacoes as string) || '', chefeEquipe: (row.chefe_equipe as string) || '',
    createdAt: (row.created_at as string) || '', updatedAt: (row.updated_at as string) || '',
  };
}

const MAP = {
  equipe: 'equipe', numero: 'numero', ano: 'ano', data: 'data', hora: 'hora', turno: 'turno',
  tipoTaf: 'tipo_taf', observacoes: 'observacoes', chefeEquipe: 'chefe_equipe',
} as const;

export async function listarTAFs(params?: { equipe?: string; ano?: string }): Promise<TreinamentoTAF[]> {
  const db = getDb();
  let q = db.from(TABLE).select('*').order('numero', { ascending: false });
  if (params?.equipe) q = q.eq('equipe', params.equipe);
  if (params?.ano) q = q.eq('ano', params.ano);
  const { data, error } = await q;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToItem);
}

export async function obterTAF(id: string): Promise<TreinamentoTAF | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) handleSupabaseError(error);
  return data ? rowToItem(data) : null;
}

export async function obterProximoNumero(ano: string): Promise<number> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('numero').eq('ano', ano).order('numero', { ascending: false }).limit(1);
  if (error) handleSupabaseError(error);
  return (data && data.length > 0 ? data[0].numero + 1 : 1);
}

function escrever(data: Omit<TreinamentoTAF, 'id' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  const r: Record<string, unknown> = { equipe: data.equipe, numero: data.numero, ano: data.ano, data: data.data, hora: data.hora, turno: data.turno, tipo_taf: data.tipoTaf, observacoes: data.observacoes, chefe_equipe: data.chefeEquipe };
  for (let i = 1; i <= 10; i++) {
    const d = data as any;
    r[`p${i}_nome`] = d[`p${i}Nome`]; r[`p${i}_funcao`] = d[`p${i}Funcao`]; r[`p${i}_idade`] = d[`p${i}Idade`]; r[`p${i}_tempo`] = d[`p${i}Tempo`];
  }
  return r;
}

export async function criarTAF(data: Omit<TreinamentoTAF, 'id' | 'createdAt' | 'updatedAt'>): Promise<TreinamentoTAF> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data: created, error } = await db.from(TABLE).insert({ ...escrever(data), created_at: now, updated_at: now }).select().single();
  if (error) handleSupabaseError(error);
  return rowToItem(created);
}

export async function atualizarTAF(id: string, data: Partial<TreinamentoTAF>): Promise<TreinamentoTAF | null> {
  const db = getDb();
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(MAP)) { if ((data as any)[k] !== undefined) r[v] = (data as any)[k]; }
  for (let i = 1; i <= 10; i++) {
    if ((data as any)[`p${i}Nome`] !== undefined) r[`p${i}_nome`] = (data as any)[`p${i}Nome`];
    if ((data as any)[`p${i}Funcao`] !== undefined) r[`p${i}_funcao`] = (data as any)[`p${i}Funcao`];
    if ((data as any)[`p${i}Idade`] !== undefined) r[`p${i}_idade`] = (data as any)[`p${i}Idade`];
    if ((data as any)[`p${i}Tempo`] !== undefined) r[`p${i}_tempo`] = (data as any)[`p${i}Tempo`];
  }
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToItem(updated) : null;
}

export async function excluirTAF(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
