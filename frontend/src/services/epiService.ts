import { supabase } from '../lib/supabase';
import type { EPI } from '../types/epi';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado. Verifique as credenciais no arquivo .env');
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

function mapRow(row: Record<string, unknown>): EPI {
  return {
    id: row.id as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    nome: row.nome as string,
    descricao: row.descricao as string,
    colaborador: row.colaborador as string,
    colaboradorId: row.colaborador_id as string,
    entreguePor: row.entregue_por as string,
    ca: row.ca as string,
    dataPagamento: row.data_pagamento as string,
    dataValidade: row.data_validade as string,
    fornecedor: row.fornecedor as string,
    notas: row.notas as string,
    status: (row.status as EPI['status']) || 'entregue',
    dataEnvioAutentique: row.data_envio_autentique as string,
    dataAssinatura: row.data_assinatura as string,
    dataDevolucao: row.data_devolucao as string,
    dataFabricacao: (row.data_fabricacao as string) || '',
    tamanho: (row.tamanho as string) || '',
    numeroSerie: (row.numero_serie as string) || '',
    estado: (row.estado as EPI['estado']) || 'Novo',
  };
}

function toRow(data: Partial<EPI>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.nome !== undefined) row.nome = data.nome;
  if (data.descricao !== undefined) row.descricao = data.descricao;
  if (data.colaborador !== undefined) row.colaborador = data.colaborador;
  if (data.colaboradorId !== undefined) row.colaborador_id = data.colaboradorId;
  if (data.entreguePor !== undefined) row.entregue_por = data.entreguePor;
  if (data.ca !== undefined) row.ca = data.ca;
  if (data.dataPagamento !== undefined) row.data_pagamento = data.dataPagamento;
  if (data.dataValidade !== undefined) row.data_validade = data.dataValidade;
  if (data.fornecedor !== undefined) row.fornecedor = data.fornecedor;
  if (data.notas !== undefined) row.notas = data.notas;
  if (data.status !== undefined) row.status = data.status;
  if (data.dataEnvioAutentique !== undefined) row.data_envio_autentique = data.dataEnvioAutentique;
  if (data.dataAssinatura !== undefined) row.data_assinatura = data.dataAssinatura;
  if (data.dataDevolucao !== undefined) row.data_devolucao = data.dataDevolucao;
  if (data.dataFabricacao !== undefined) row.data_fabricacao = data.dataFabricacao;
  if (data.tamanho !== undefined) row.tamanho = data.tamanho;
  if (data.numeroSerie !== undefined) row.numero_serie = data.numeroSerie;
  if (data.estado !== undefined) row.estado = data.estado;
  row.updated_at = new Date().toISOString();
  return row;
}

export async function listarEPIs(): Promise<EPI[]> {
  const db = getDb();
  const { data, error } = await db
    .from('epis')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(mapRow);
}

export async function criarEPI(
  data: Omit<EPI, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'dataEnvioAutentique' | 'dataAssinatura' | 'dataDevolucao'>
): Promise<EPI | null> {
  const row: Record<string, unknown> = {
    created_by: data.createdBy,
    nome: data.nome,
    descricao: data.descricao,
    colaborador: data.colaborador,
    colaborador_id: data.colaboradorId,
    entregue_por: data.entreguePor,
    ca: data.ca,
    data_pagamento: data.dataPagamento,
    data_validade: data.dataValidade,
    fornecedor: data.fornecedor,
    notas: data.notas,
    data_fabricacao: data.dataFabricacao || '',
    tamanho: data.tamanho || '',
    numero_serie: data.numeroSerie || '',
    estado: data.estado || 'Novo',
    status: 'pago',
    data_envio_autentique: '',
    data_assinatura: '',
    data_devolucao: '',
  };
  const db = getDb();
  const { data: result, error } = await db
    .from('epis')
    .insert(row)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return mapRow(result);
}

export async function atualizarEPI(id: string, data: Partial<EPI>): Promise<EPI | null> {
  const db = getDb();
  const { data: result, error } = await db
    .from('epis')
    .update(toRow(data))
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return mapRow(result);
}

export async function excluirEPI(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('epis').delete().eq('id', id);
  if (error) handleSupabaseError(error);
}

export async function pagarEPI(id: string): Promise<EPI | null> {
  return atualizarEPI(id, {
    status: 'pago',
    dataPagamento: new Date().toISOString().split('T')[0],
  });
}

export async function enviarAutentiqueEPI(id: string): Promise<EPI | null> {
  return atualizarEPI(id, {
    status: 'enviado_autentique',
    dataEnvioAutentique: new Date().toISOString().split('T')[0],
  });
}

export async function assinarEPI(id: string): Promise<EPI | null> {
  return atualizarEPI(id, {
    status: 'assinado',
    dataAssinatura: new Date().toISOString().split('T')[0],
  });
}

export async function devolverEPI(id: string): Promise<EPI | null> {
  return atualizarEPI(id, {
    status: 'devolvido',
    dataDevolucao: new Date().toISOString().split('T')[0],
  });
}
