import { supabase } from '../lib/supabase';
import { criarReaDadosVazios } from '../types/rea';
import type { ReaDados, ReaRegistro, ReaRegistroInput, ReaStatus } from '../types/rea';

const TABLE = 'rea_registros';

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

function parseJSON(value: unknown): ReaDados {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as ReaDados : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value as ReaDados : {};
}

function normalizarDados(dados?: ReaDados): ReaDados {
  return { ...criarReaDadosVazios(), ...dados };
}

function rowToRea(row: Record<string, unknown>): ReaRegistro {
  const dados = normalizarDados(parseJSON(row.dados));
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    numero: (row.numero as string) || '',
    status: (row.status as ReaStatus) || 'Aberta',
    equipe: (row.equipe as string) || '',
    aerodromo: (row.aerodromo as string) || dados.aerodromo || '',
    cidade: (row.cidade as string) || dados.cidade || '',
    dataAcidente: (row.data_acidente as string) || dados.dataAcidente || '',
    horaAcidente: (row.hora_acidente as string) || dados.horaLocalAcidente || '',
    matricula: (row.matricula as string) || dados.matricula || '',
    empresa: (row.empresa as string) || dados.empresa || '',
    dados,
  };
}

function inputToRow(input: Partial<ReaRegistroInput>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  if (input.numero !== undefined) row.numero = input.numero;
  if (input.status !== undefined) row.status = input.status;
  if (input.equipe !== undefined) row.equipe = input.equipe;
  if (input.dados !== undefined) {
    const dados = normalizarDados(input.dados);
    row.dados = dados;
    row.aerodromo = dados.aerodromo || '';
    row.cidade = dados.cidade || '';
    row.data_acidente = dados.dataAcidente || '';
    row.hora_acidente = dados.horaLocalAcidente || '';
    row.matricula = dados.matricula || '';
    row.empresa = dados.empresa || '';
  }
  return row;
}

export async function listarReas(params?: {
  status?: ReaStatus;
  equipe?: string;
  dataGte?: string;
  dataLte?: string;
}): Promise<ReaRegistro[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (params?.status) query = query.eq('status', params.status);
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.dataGte) query = query.gte('data_acidente', params.dataGte);
  if (params?.dataLte) query = query.lte('data_acidente', params.dataLte);

  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToRea);
}

export async function obterRea(id: string): Promise<ReaRegistro | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToRea(data) : null;
}

export async function criarRea(input: ReaRegistroInput): Promise<ReaRegistro> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    ...inputToRow(input),
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToRea(data);
}

export async function atualizarRea(id: string, input: Partial<ReaRegistroInput>): Promise<ReaRegistro | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).update(inputToRow(input)).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return data ? rowToRea(data) : null;
}

export async function excluirRea(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
