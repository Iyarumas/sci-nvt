import { supabase } from '../lib/supabase';
import type { OrdemServico, OrdemServicoInput } from '../types/ordemServico';

const TABLE = 'ordens_servico';

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

function rowToOrdemServico(row: Record<string, unknown>): OrdemServico {
  return {
    id: row.id as string,
    numero: (row.numero as string) || '',
    dataEmissao: (row.data_emissao as string) || '',
    dataConclusao: (row.data_conclusao as string) || '',
    solicitanteId: (row.solicitante_id as string) || '',
    solicitanteNome: (row.solicitante_nome as string) || '',
    solicitanteCargo: (row.solicitante_cargo as string) || '',
    equipe: (row.equipe as string) || '',
    local: (row.local as string) || '',
    descricao: (row.descricao as string) || '',
    imagem: (row.imagem as string) || '',
    prioridade: ((row.prioridade as string) || 'Média') as OrdemServico['prioridade'],
    status: ((row.status as string) || 'Aberta') as OrdemServico['status'],
    motivoManutencao: (row.motivo_manutencao as string) || '',
    manutencaoPor: (row.manutencao_por as string) || '',
    manutencaoPorCargo: (row.manutencao_por_cargo as string) || '',
    manutencaoEmpresa: (row.manutencao_empresa as string) || '',
    manutencaoEmpresaPessoa: (row.manutencao_empresa_pessoa as string) || '',
    dataManutencao: (row.data_manutencao as string) || '',
    motivoCancelamento: (row.motivo_cancelamento as string) || '',
    canceladoPor: (row.cancelado_por as string) || '',
    canceladoPorCargo: (row.cancelado_por_cargo as string) || '',
    dataCancelamento: (row.data_cancelamento as string) || '',
    finalizadoPor: (row.finalizado_por as string) || '',
    finalizadoPorCargo: (row.finalizado_por_cargo as string) || '',
    empresaFinalizacao: (row.empresa_finalizacao as string) || '',
    finalizacaoEmpresaPessoa: (row.finalizacao_empresa_pessoa as string) || '',
    finalizacaoDescricao: (row.finalizacao_descricao as string) || '',
    dataFinalizacao: (row.data_finalizacao as string) || '',
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function inputToRow(input: Partial<OrdemServicoInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.numero !== undefined) row.numero = input.numero;
  if (input.dataEmissao !== undefined) row.data_emissao = input.dataEmissao;
  if (input.dataConclusao !== undefined) row.data_conclusao = input.dataConclusao;
  if (input.solicitanteId !== undefined) row.solicitante_id = input.solicitanteId;
  if (input.solicitanteNome !== undefined) row.solicitante_nome = input.solicitanteNome;
  if (input.solicitanteCargo !== undefined) row.solicitante_cargo = input.solicitanteCargo;
  if (input.equipe !== undefined) row.equipe = input.equipe;
  if (input.local !== undefined) row.local = input.local;
  if (input.descricao !== undefined) row.descricao = input.descricao;
  if (input.imagem !== undefined) row.imagem = input.imagem;
  if (input.prioridade !== undefined) row.prioridade = input.prioridade;
  if (input.status !== undefined) row.status = input.status;
  if (input.motivoManutencao !== undefined) row.motivo_manutencao = input.motivoManutencao;
  if (input.manutencaoPor !== undefined) row.manutencao_por = input.manutencaoPor;
  if (input.manutencaoPorCargo !== undefined) row.manutencao_por_cargo = input.manutencaoPorCargo;
  if (input.manutencaoEmpresa !== undefined) row.manutencao_empresa = input.manutencaoEmpresa;
  if (input.manutencaoEmpresaPessoa !== undefined) row.manutencao_empresa_pessoa = input.manutencaoEmpresaPessoa;
  if (input.dataManutencao !== undefined) row.data_manutencao = input.dataManutencao;
  if (input.motivoCancelamento !== undefined) row.motivo_cancelamento = input.motivoCancelamento;
  if (input.canceladoPor !== undefined) row.cancelado_por = input.canceladoPor;
  if (input.canceladoPorCargo !== undefined) row.cancelado_por_cargo = input.canceladoPorCargo;
  if (input.dataCancelamento !== undefined) row.data_cancelamento = input.dataCancelamento;
  if (input.finalizadoPor !== undefined) row.finalizado_por = input.finalizadoPor;
  if (input.finalizadoPorCargo !== undefined) row.finalizado_por_cargo = input.finalizadoPorCargo;
  if (input.empresaFinalizacao !== undefined) row.empresa_finalizacao = input.empresaFinalizacao;
  if (input.finalizacaoEmpresaPessoa !== undefined) row.finalizacao_empresa_pessoa = input.finalizacaoEmpresaPessoa;
  if (input.finalizacaoDescricao !== undefined) row.finalizacao_descricao = input.finalizacaoDescricao;
  if (input.dataFinalizacao !== undefined) row.data_finalizacao = input.dataFinalizacao;
  if (input.observacoes !== undefined) row.observacoes = input.observacoes;
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  return row;
}

export async function listarOrdensServico(): Promise<OrdemServico[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToOrdemServico);
}

export async function obterOrdemServico(id: string): Promise<OrdemServico | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) handleSupabaseError(error);
  return data ? rowToOrdemServico(data) : null;
}

export async function criarOrdemServico(input: OrdemServicoInput): Promise<OrdemServico> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .insert({ ...inputToRow(input), created_at: now, updated_at: now })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return rowToOrdemServico(data);
}

export async function atualizarOrdemServico(id: string, input: Partial<OrdemServicoInput>): Promise<OrdemServico | null> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return data ? rowToOrdemServico(data) : null;
}

export async function excluirOrdemServico(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
