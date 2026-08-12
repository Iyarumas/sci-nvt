import { supabase } from '../lib/supabase';
import type { CertificacaoCurso } from '../types/certificacaoCurso';

const TABLE = 'certificacoes_cursos';

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

function rowToCertificacaoCurso(row: Record<string, unknown>): CertificacaoCurso {
  return {
    id: row.id as string,
    funcionarioId: row.funcionario_id as string,
    funcionarioNome: (row.funcionario_nome as string) || '',
    cursoTipo: (row.curso_tipo as string) || '',
    cursoNome: (row.curso_nome as string) || '',
    dataEmissao: (row.data_emissao as string) || '',
    dataValidade: (row.data_validade as string) || '',
    semValidade: !!row.sem_validade,
    empresa: (row.empresa as string) || '',
    arquivo: (row.arquivo as string) || '',
    tipoArquivo: (row.tipo_arquivo as 'image' | 'pdf') || 'image',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function toRow(data: Partial<CertificacaoCurso>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (data.funcionarioId !== undefined) r.funcionario_id = data.funcionarioId;
  if (data.funcionarioNome !== undefined) r.funcionario_nome = data.funcionarioNome;
  if (data.cursoTipo !== undefined) r.curso_tipo = data.cursoTipo;
  if (data.cursoNome !== undefined) r.curso_nome = data.cursoNome;
  if (data.dataEmissao !== undefined) r.data_emissao = data.dataEmissao;
  if (data.dataValidade !== undefined) r.data_validade = data.dataValidade;
  if (data.semValidade !== undefined) r.sem_validade = data.semValidade;
  if (data.empresa !== undefined) r.empresa = data.empresa;
  if (data.arquivo !== undefined) r.arquivo = data.arquivo;
  if (data.tipoArquivo !== undefined) r.tipo_arquivo = data.tipoArquivo;
  r.updated_at = new Date().toISOString();
  return r;
}

export async function listarCertificacoesCursos(params?: { funcionarioIds?: string[] }): Promise<CertificacaoCurso[]> {
  const db = getDb();
  if (params?.funcionarioIds && params.funcionarioIds.length === 0) return [];
  let query = db.from(TABLE).select('*');
  if (params?.funcionarioIds) query = query.in('funcionario_id', params.funcionarioIds);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToCertificacaoCurso);
}

export async function certificacoesCursosPorFuncionario(funcionarioId: string): Promise<CertificacaoCurso[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('funcionario_id', funcionarioId);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToCertificacaoCurso);
}

export async function criarCertificacaoCurso(data: Omit<CertificacaoCurso, 'id' | 'createdAt' | 'updatedAt'>): Promise<CertificacaoCurso> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...toRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToCertificacaoCurso(created);
}

export async function excluirCertificacaoCurso(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
