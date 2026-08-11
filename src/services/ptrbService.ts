import { supabase } from '../lib/supabase';
import type { PTRB } from '../types/ptrb';

const TABLE = 'ptrb_registros';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function parseJSON(val: unknown): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

function rowToPTRB(row: Record<string, unknown>): PTRB {
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    data: (row.data as string) || '',
    horaInicio: (row.hora_inicio as string) || '',
    horaTermino: (row.hora_termino as string) || '',
    duracao: (row.duracao as string) || '',
    horas: Number(row.horas) || 0,
    equipe: (row.equipe as string) || '',
    turno: (row.turno as string) || '',
    participantes: parseJSON(row.participantes) || [],
    observacoes: (row.observacoes as string) || '',
    instrutor: (row.instrutor as string) || '',
    assuntoMinistrado: (row.assunto_ministrado as string) || '',
    descricao: (row.descricao as string) || '',
    informacoesComplementares: (row.informacoes_complementares as string) || '',
    fotos: parseJSON(row.fotos) || [],
  };
}

export async function listarPTRBs(params?: {
  dataGte?: string;
  dataLte?: string;
  equipe?: string;
  createdBy?: string;
  assunto?: string;
}): Promise<PTRB[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (params?.dataGte) query = query.gte('data', params.dataGte);
  if (params?.dataLte) query = query.lte('data', params.dataLte);
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.createdBy) query = query.eq('created_by', params.createdBy);
  if (params?.assunto) query = query.eq('assunto_ministrado', params.assunto);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToPTRB);
}

export async function listarPTRBsPorUsuario(username: string): Promise<PTRB[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('created_by', username);
  if (error) throw error;
  return (data || []).map(rowToPTRB);
}

export async function obterPTRB(id: string): Promise<PTRB | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) return null;
  return data ? rowToPTRB(data) : null;
}

export async function criarPTRB(data: Omit<PTRB, 'id' | 'createdAt' | 'updatedAt'>): Promise<PTRB> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    created_by: data.createdBy, created_at: now, updated_at: now,
    data: data.data, hora_inicio: data.horaInicio, hora_termino: data.horaTermino,
    duracao: data.duracao, horas: data.horas, equipe: data.equipe, turno: data.turno,
    participantes: data.participantes, observacoes: data.observacoes,
    instrutor: data.instrutor, assunto_ministrado: data.assuntoMinistrado,
    descricao: data.descricao, informacoes_complementares: data.informacoesComplementares,
    fotos: data.fotos,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToPTRB(created);
}

export async function atualizarPTRB(id: string, data: Partial<PTRB>): Promise<PTRB | null> {
  const db = getDb();
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.data !== undefined) r.data = data.data;
  if (data.horaInicio !== undefined) r.hora_inicio = data.horaInicio;
  if (data.horaTermino !== undefined) r.hora_termino = data.horaTermino;
  if (data.duracao !== undefined) r.duracao = data.duracao;
  if (data.horas !== undefined) r.horas = data.horas;
  if (data.equipe !== undefined) r.equipe = data.equipe;
  if (data.turno !== undefined) r.turno = data.turno;
  if (data.participantes !== undefined) r.participantes = data.participantes;
  if (data.observacoes !== undefined) r.observacoes = data.observacoes;
  if (data.instrutor !== undefined) r.instrutor = data.instrutor;
  if (data.assuntoMinistrado !== undefined) r.assunto_ministrado = data.assuntoMinistrado;
  if (data.descricao !== undefined) r.descricao = data.descricao;
  if (data.informacoesComplementares !== undefined) r.informacoes_complementares = data.informacoesComplementares;
  if (data.fotos !== undefined) r.fotos = data.fotos;
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) throw error;
  return updated ? rowToPTRB(updated) : null;
}

export async function excluirPTRB(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}
