import { supabase } from '../lib/supabase';
import type { EscalaDiaria } from '../types/escala';
import {
  assertSemErros,
  validarEscalaDiaria,
} from '../utils/regrasOperacionais';

const TABLE = 'escalas_diarias';

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

function parseJSON(val: unknown): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

function rowToEscala(row: Record<string, unknown>): EscalaDiaria {
  const g = parseJSON(row.guarnicoes);
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    equipe: (row.equipe as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    dataPlantao: (row.data_plantao as string) || '',
    horarioInicio: (row.horario_inicio as string) || '',
    horarioTermino: (row.horario_termino as string) || '',
    turno: (row.turno as string) || '',
    guarnicoes: g?.cci02 ? g : { cci02: { baMc:'', baCe:'', ba2:'' }, cci03: { baMc:'', ba2_1:'', ba2_2:'' }, crs: { baMc:'', baLr:'', baRe1:'', baRe2:'' } },
    bds: parseJSON(row.bds) || { funcao: '', nomeGuerra: '' },
    ptr1: parseJSON(row.ptr1) || { funcao: '', nomeGuerra: '' },
    ptr2: parseJSON(row.ptr2) || { funcao: '', nomeGuerra: '' },
    atestados: parseJSON(row.atestados) || [],
    trocas: parseJSON(row.trocas) || [],
    radio: parseJSON(row.radio) || [],
  };
}

export async function listarEscalas(): Promise<EscalaDiaria[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*');
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToEscala);
}

export async function listarEscalasPorUsuario(username: string): Promise<EscalaDiaria[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('created_by', username);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToEscala);
}

export async function obterEscala(id: string): Promise<EscalaDiaria | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToEscala(data) : null;
}

export async function criarEscala(data: Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<EscalaDiaria> {
  const db = getDb();
  const existentes = await listarEscalas();
  const duplicada = existentes.find(e => e.equipe === data.equipe && e.dataPlantao === data.dataPlantao);
  if (duplicada) return duplicada;
  assertSemErros(validarEscalaDiaria({ escala: data, escalasExistentes: existentes }));
  const now = new Date().toISOString();
  const row = {
    created_by: data.createdBy, created_at: now, updated_at: now,
    equipe: data.equipe, chefe_equipe: data.chefeEquipe,
    data_plantao: data.dataPlantao, horario_inicio: data.horarioInicio,
    horario_termino: data.horarioTermino, turno: data.turno,
    guarnicoes: data.guarnicoes, bds: data.bds,
    ptr1: data.ptr1, ptr2: data.ptr2,
    atestados: data.atestados, trocas: data.trocas,
    radio: data.radio,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToEscala(created);
}

export async function atualizarEscala(id: string, data: Partial<EscalaDiaria>): Promise<EscalaDiaria | null> {
  const db = getDb();
  const atual = await obterEscala(id);
  if (!atual) return null;
  const merged: EscalaDiaria = { ...atual, ...data };
  const existentes = await listarEscalas();
  assertSemErros(validarEscalaDiaria({
    escala: merged,
    escalasExistentes: existentes,
    ignoreEscalaId: id,
  }));
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.equipe !== undefined) r.equipe = data.equipe;
  if (data.chefeEquipe !== undefined) r.chefe_equipe = data.chefeEquipe;
  if (data.dataPlantao !== undefined) r.data_plantao = data.dataPlantao;
  if (data.horarioInicio !== undefined) r.horario_inicio = data.horarioInicio;
  if (data.horarioTermino !== undefined) r.horario_termino = data.horarioTermino;
  if (data.turno !== undefined) r.turno = data.turno;
  if (data.guarnicoes !== undefined) r.guarnicoes = data.guarnicoes;
  if (data.bds !== undefined) r.bds = data.bds;
  if (data.ptr1 !== undefined) r.ptr1 = data.ptr1;
  if (data.ptr2 !== undefined) r.ptr2 = data.ptr2;
  if (data.atestados !== undefined) r.atestados = data.atestados;
  if (data.trocas !== undefined) r.trocas = data.trocas;
  if (data.radio !== undefined) r.radio = data.radio;
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToEscala(updated) : null;
}

export async function excluirEscala(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
