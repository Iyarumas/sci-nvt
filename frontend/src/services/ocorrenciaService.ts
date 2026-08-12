import { supabase } from '../lib/supabase';
import type { Ocorrencia } from '../types/ocorrencia';

const TABLE = 'ocorrencias_operacionais';

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

function rowToOcorrencia(row: Record<string, unknown>): Ocorrencia {
  const numero = (row.numero as string) || '';
  const data = (row.data as string) || '';
  const categoria = (row.categoria as Ocorrencia['categoria']) || 'Outros';
  const tipoDocumento = row.tipo_documento === 'RAE' ? 'REA' : ((row.tipo_documento as Ocorrencia['tipoDocumento']) || 'BONA');
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    tipoDocumento,
    numero,
    numeroOcorrencia: numero,
    data,
    dataOcorrencia: data,
    hora: (row.hora as string) || '',
    equipe: (row.equipe as string) || '',
    turno: (row.turno as string) || '',
    categoria,
    categoriaOcorrencia: categoria,
    titulo: (row.titulo as string) || '',
    descricao: (row.descricao as string) || '',
    local: (row.local as string) || '',
    envolvidos: (row.envolvidos as string) || '',
    acoesTomadas: (row.acoes_tomadas as string) || '',
    status: (row.status as Ocorrencia['status']) || 'Aberta',
    fotos: parseJSON(row.fotos) || [],
  };
}

export async function listarOcorrencias(params?: {
  status?: string;
  dataGte?: string;
  dataLte?: string;
  equipe?: string;
  categoria?: string;
  numeroPrefixo?: string;
}): Promise<Ocorrencia[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (params?.status) query = query.eq('status', params.status);
  if (params?.dataGte) query = query.gte('data', params.dataGte);
  if (params?.dataLte) query = query.lte('data', params.dataLte);
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.categoria) query = query.eq('categoria', params.categoria);
  if (params?.numeroPrefixo) query = query.like('numero', params.numeroPrefixo + '%');
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToOcorrencia);
}

export async function criarOcorrencia(data: Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ocorrencia> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    created_by: data.createdBy, created_at: now, updated_at: now,
    tipo_documento: data.tipoDocumento, numero: data.numero,
    data: data.data, hora: data.hora, equipe: data.equipe, turno: data.turno,
    categoria: data.categoria, titulo: data.titulo, descricao: data.descricao,
    local: data.local, envolvidos: data.envolvidos, acoes_tomadas: data.acoesTomadas,
    status: data.status, fotos: data.fotos,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToOcorrencia(created);
}

export async function atualizarOcorrencia(id: string, data: Partial<Ocorrencia>): Promise<Ocorrencia | null> {
  const db = getDb();
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.tipoDocumento !== undefined) r.tipo_documento = data.tipoDocumento;
  if (data.numero !== undefined) r.numero = data.numero;
  if (data.data !== undefined) r.data = data.data;
  if (data.hora !== undefined) r.hora = data.hora;
  if (data.equipe !== undefined) r.equipe = data.equipe;
  if (data.turno !== undefined) r.turno = data.turno;
  if (data.categoria !== undefined) r.categoria = data.categoria;
  if (data.titulo !== undefined) r.titulo = data.titulo;
  if (data.descricao !== undefined) r.descricao = data.descricao;
  if (data.local !== undefined) r.local = data.local;
  if (data.envolvidos !== undefined) r.envolvidos = data.envolvidos;
  if (data.acoesTomadas !== undefined) r.acoes_tomadas = data.acoesTomadas;
  if (data.status !== undefined) r.status = data.status;
  if (data.fotos !== undefined) r.fotos = data.fotos;
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToOcorrencia(updated) : null;
}

export async function contarOcorrenciasAbertas(): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Fechada');
  if (error) handleSupabaseError(error);
  return count || 0;
}

export async function excluirOcorrencia(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
