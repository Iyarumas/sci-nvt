import { supabase } from '../lib/supabase';
import type { CertificacaoNR } from '../types/certificacao';

const TABLE = 'certificacoes_nr';

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

function rowToCertificacao(row: Record<string, unknown>): CertificacaoNR {
  return {
    id: row.id as string,
    funcionarioId: row.funcionario_id as string,
    funcionarioNome: (row.funcionario_nome as string) || '',
    nrNumero: (row.nr_numero as string) || '',
    nrNome: (row.nr_nome as string) || '',
    dataEmissao: (row.data_emissao as string) || '',
    dataValidade: (row.data_validade as string) || '',
    empresa: (row.empresa as string) || '',
    arquivo: (row.arquivo as string) || '',
    tipoArquivo: (row.tipo_arquivo as 'image' | 'pdf') || 'image',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function toRow(data: Partial<CertificacaoNR>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.funcionarioId !== undefined) row.funcionario_id = data.funcionarioId;
  if (data.funcionarioNome !== undefined) row.funcionario_nome = data.funcionarioNome;
  if (data.nrNumero !== undefined) row.nr_numero = data.nrNumero;
  if (data.nrNome !== undefined) row.nr_nome = data.nrNome;
  if (data.dataEmissao !== undefined) row.data_emissao = data.dataEmissao;
  if (data.dataValidade !== undefined) row.data_validade = data.dataValidade;
  if (data.empresa !== undefined) row.empresa = data.empresa;
  if (data.arquivo !== undefined) row.arquivo = data.arquivo;
  if (data.tipoArquivo !== undefined) row.tipo_arquivo = data.tipoArquivo;
  row.updated_at = new Date().toISOString();
  return row;
}

export async function listarCertificacoes(params?: { funcionarioIds?: string[] }): Promise<CertificacaoNR[]> {
  const db = getDb();
  if (params?.funcionarioIds && params.funcionarioIds.length === 0) return [];
  let query = db.from(TABLE).select('*');
  if (params?.funcionarioIds) query = query.in('funcionario_id', params.funcionarioIds);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToCertificacao);
}

export async function certificacoesPorFuncionario(funcionarioId: string): Promise<CertificacaoNR[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('funcionario_id', funcionarioId);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToCertificacao);
}

export async function criarCertificacao(data: Omit<CertificacaoNR, 'id' | 'createdAt' | 'updatedAt'>): Promise<CertificacaoNR> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...toRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToCertificacao(created);
}

export async function atualizarCertificacao(id: string, data: Partial<CertificacaoNR>): Promise<CertificacaoNR | null> {
  const db = getDb();
  const { data: updated, error } = await db.from(TABLE).update(toRow(data)).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToCertificacao(updated) : null;
}

export async function excluirCertificacao(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
