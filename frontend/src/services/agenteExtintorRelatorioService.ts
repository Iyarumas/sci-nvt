import { supabase } from '../lib/supabase';
import type { AgenteExtintor } from '../types/agenteExtintor';
import type {
  AgenteExtintorMovimentacao,
  AgenteExtintorRelatorio,
  AgenteExtintorRelatorioItem,
} from '../types/agenteExtintorRelatorio';

const TABLE_RELATORIOS = 'agentes_extintores_relatorios';
const TABLE_ITENS = 'agentes_extintores_relatorio_itens';
const TABLE_MOVIMENTACOES = 'agentes_extintores_movimentacoes';

function getDb() {
  if (!supabase) throw new Error('Banco de dados não configurado.');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  const message = err instanceof Error
    ? err.message
    : err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || 'Erro inesperado no banco de dados')
      : 'Erro inesperado no banco de dados';
  throw new Error(message);
}

function rowToRelatorio(row: Record<string, unknown>): AgenteExtintorRelatorio {
  return {
    id: String(row.id || ''),
    competencia: String(row.competencia || ''),
    dataRelatorio: String(row.data_relatorio || ''),
    status: (row.status as AgenteExtintorRelatorio['status']) || 'Rascunho',
    pqExigido: Number(row.pq_exigido || 0),
    lgeExigido: Number(row.lge_exigido || 0),
    aguaExigida: Number(row.agua_exigida || 0),
    aguaEmLinha: Number(row.agua_em_linha || 0),
    aguaCciRt: Number(row.agua_cci_rt || 0),
    aguaEstoque: Number(row.agua_estoque || 0),
    reservaTecnicaPercentual: Number(row.reserva_tecnica_percentual || 100),
    observacoes: String(row.observacoes || ''),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    finalizadoPor: String(row.finalizado_por || ''),
    finalizadoEm: String(row.finalizado_em || ''),
  };
}

function rowToItem(row: Record<string, unknown>): AgenteExtintorRelatorioItem {
  return {
    id: String(row.id || ''),
    relatorioId: String(row.relatorio_id || ''),
    agenteExtintorId: String(row.agente_extintor_id || ''),
    marcaAgente: String(row.marca_agente || ''),
    produto: row.produto as AgenteExtintorRelatorioItem['produto'],
    tipo: row.tipo as AgenteExtintorRelatorioItem['tipo'],
    dosagem: (row.dosagem || '') as AgenteExtintorRelatorioItem['dosagem'],
    classe: (row.classe || '') as AgenteExtintorRelatorioItem['classe'],
    composicao: (row.composicao || '') as AgenteExtintorRelatorioItem['composicao'],
    lote: String(row.lote || ''),
    validade: String(row.validade || ''),
    fabricacao: String(row.fabricacao || ''),
    localizacao: String(row.localizacao || ''),
    quantidade: Number(row.quantidade || 0),
    unidade: row.unidade as AgenteExtintorRelatorioItem['unidade'],
    recipiente: String(row.recipiente || ''),
    quantidadeRecipientes: Number(row.quantidade_recipientes || 0),
    capacidadeRecipiente: Number(row.capacidade_recipiente || 0),
    validadeEnsaioLaboratorial: String(row.validade_ensaio_laboratorial || ''),
    validadeEnsaioFogo: String(row.validade_ensaio_fogo || ''),
    validadeTesteHidrostatico: String(row.validade_teste_hidrostatico || ''),
    validadeCilindro: String(row.validade_cilindro || ''),
    createdAt: String(row.created_at || ''),
  };
}

function rowToMovimentacao(row: Record<string, unknown>): AgenteExtintorMovimentacao {
  return {
    id: String(row.id || ''),
    relatorioId: String(row.relatorio_id || ''),
    agenteExtintorId: String(row.agente_extintor_id || ''),
    data: String(row.data || ''),
    tipo: row.tipo as AgenteExtintorMovimentacao['tipo'],
    resultado: String(row.resultado || ''),
    validadeResultante: String(row.validade_resultante || ''),
    quantidadeAnterior: Number(row.quantidade_anterior || 0),
    quantidadeNova: Number(row.quantidade_nova || 0),
    unidade: String(row.unidade || ''),
    observacoes: String(row.observacoes || ''),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
  };
}

export async function listarRelatoriosAgentesExtintores(): Promise<AgenteExtintorRelatorio[]> {
  const { data, error } = await getDb().from(TABLE_RELATORIOS).select('*').order('competencia', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToRelatorio);
}

export async function obterItensRelatorioAgentesExtintores(relatorioId: string): Promise<AgenteExtintorRelatorioItem[]> {
  const { data, error } = await getDb().from(TABLE_ITENS).select('*').eq('relatorio_id', relatorioId).order('produto').order('localizacao');
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToItem);
}

export async function obterMovimentacoesAgentesExtintores(relatorioId: string): Promise<AgenteExtintorMovimentacao[]> {
  const { data, error } = await getDb().from(TABLE_MOVIMENTACOES).select('*').eq('relatorio_id', relatorioId).order('data');
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToMovimentacao);
}

export async function criarRelatorioAgentesExtintores(params: {
  competencia: string;
  dataRelatorio: string;
  createdBy: string;
  agentes: AgenteExtintor[];
}): Promise<AgenteExtintorRelatorio> {
  const now = new Date().toISOString();
  const { data, error } = await getDb().from(TABLE_RELATORIOS).insert({
    competencia: params.competencia,
    data_relatorio: params.dataRelatorio,
    status: 'Rascunho',
    created_by: params.createdBy,
    created_at: now,
    updated_at: now,
  }).select().single();
  if (error) handleSupabaseError(error);

  const relatorio = rowToRelatorio(data);
  if (params.agentes.length) {
    const snapshots = params.agentes.map(agente => ({
      relatorio_id: relatorio.id,
      agente_extintor_id: agente.id,
      marca_agente: agente.marcaAgente,
      produto: agente.produto,
      tipo: agente.tipo,
      dosagem: agente.dosagem,
      classe: agente.classe,
      composicao: agente.composicao,
      lote: agente.lote,
      validade: agente.validade,
      fabricacao: agente.fabricacao,
      localizacao: agente.localizacao,
      quantidade: agente.quantidade,
      unidade: agente.unidade,
      recipiente: agente.recipiente,
      quantidade_recipientes: agente.quantidadeRecipientes,
      capacidade_recipiente: agente.capacidadeRecipiente,
      validade_ensaio_laboratorial: agente.validadeEnsaioLaboratorial,
      validade_ensaio_fogo: agente.validadeEnsaioFogo,
      validade_teste_hidrostatico: agente.validadeTesteHidrostatico,
      validade_cilindro: agente.validadeCilindro,
      created_at: now,
    }));
    const { error: itensError } = await getDb().from(TABLE_ITENS).insert(snapshots);
    if (itensError) handleSupabaseError(itensError);
  }
  return relatorio;
}

export async function atualizarRelatorioAgentesExtintores(
  id: string,
  data: Partial<Pick<AgenteExtintorRelatorio,
    'dataRelatorio' | 'status' | 'pqExigido' | 'lgeExigido' | 'aguaExigida' |
    'aguaEmLinha' | 'aguaCciRt' | 'aguaEstoque' | 'reservaTecnicaPercentual' |
    'observacoes' | 'finalizadoPor' | 'finalizadoEm'>>,
): Promise<AgenteExtintorRelatorio> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.dataRelatorio !== undefined) row.data_relatorio = data.dataRelatorio;
  if (data.status !== undefined) row.status = data.status;
  if (data.pqExigido !== undefined) row.pq_exigido = data.pqExigido;
  if (data.lgeExigido !== undefined) row.lge_exigido = data.lgeExigido;
  if (data.aguaExigida !== undefined) row.agua_exigida = data.aguaExigida;
  if (data.aguaEmLinha !== undefined) row.agua_em_linha = data.aguaEmLinha;
  if (data.aguaCciRt !== undefined) row.agua_cci_rt = data.aguaCciRt;
  if (data.aguaEstoque !== undefined) row.agua_estoque = data.aguaEstoque;
  if (data.reservaTecnicaPercentual !== undefined) row.reserva_tecnica_percentual = data.reservaTecnicaPercentual;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.finalizadoPor !== undefined) row.finalizado_por = data.finalizadoPor;
  if (data.finalizadoEm !== undefined) row.finalizado_em = data.finalizadoEm;

  const { data: updated, error } = await getDb().from(TABLE_RELATORIOS).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToRelatorio(updated);
}

export async function excluirRelatorioAgentesExtintores(id: string): Promise<void> {
  const { error } = await getDb().from(TABLE_RELATORIOS).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}

export async function criarMovimentacaoAgenteExtintor(
  data: Omit<AgenteExtintorMovimentacao, 'id' | 'createdAt'>,
): Promise<AgenteExtintorMovimentacao> {
  const { data: created, error } = await getDb().from(TABLE_MOVIMENTACOES).insert({
    relatorio_id: data.relatorioId,
    agente_extintor_id: data.agenteExtintorId || null,
    data: data.data,
    tipo: data.tipo,
    resultado: data.resultado,
    validade_resultante: data.validadeResultante,
    quantidade_anterior: data.quantidadeAnterior,
    quantidade_nova: data.quantidadeNova,
    unidade: data.unidade,
    observacoes: data.observacoes,
    created_by: data.createdBy,
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) handleSupabaseError(error);
  return rowToMovimentacao(created);
}

export async function excluirMovimentacaoAgenteExtintor(id: string): Promise<void> {
  const { error } = await getDb().from(TABLE_MOVIMENTACOES).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
