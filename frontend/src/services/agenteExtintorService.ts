import { supabase } from '../lib/supabase';
import type { AgenteExtintor } from '../types/agenteExtintor';
import {
  normalizarProdutoAgenteExtintor,
  normalizarStatusAgenteExtintor,
  normalizarTipoAgenteExtintor,
  normalizarUnidadeAgenteExtintor,
} from '../types/agenteExtintor';

const TABLE = 'agentes_extintores';

function getDb() {
  if (!supabase) throw new Error('Supabase nao configurado. Verifique as credenciais no arquivo .env');
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

function rowToAgenteExtintor(row: Record<string, unknown>): AgenteExtintor {
  const produto = normalizarProdutoAgenteExtintor(row.produto || row.tipo);
  return {
    id: row.id as string,
    marcaAgente: (row.marca_agente as string) || (row.nome as string) || '',
    produto,
    tipo: normalizarTipoAgenteExtintor(row.tipo, produto),
    dosagem: (row.dosagem as AgenteExtintor['dosagem']) || '',
    classe: (row.classe as AgenteExtintor['classe']) || '',
    quantidade: Number(row.quantidade || 0),
    unidade: normalizarUnidadeAgenteExtintor(row.unidade, produto),
    lote: (row.lote as string) || '',
    validade: (row.validade as string) || '',
    validadeEnsaioLaboratorial: (row.validade_ensaio_laboratorial as string) || '',
    validadeEnsaioFogo: (row.validade_ensaio_fogo as string) || '',
    fabricacao: (row.fabricacao as string) || '',
    composicao: (row.composicao as AgenteExtintor['composicao']) || '',
    testeHidrostatico: (row.teste_hidrostatico as string) || '',
    validadeTesteHidrostatico: (row.validade_teste_hidrostatico as string) || '',
    validadeCilindro: (row.validade_cilindro as string) || '',
    localizacao: (row.localizacao as string) || '',
    status: normalizarStatusAgenteExtintor(row.status),
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function agenteExtintorToRow(data: Partial<AgenteExtintor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.marcaAgente !== undefined) {
    row.marca_agente = data.marcaAgente;
    row.nome = data.marcaAgente;
  }
  if (data.produto !== undefined) row.produto = data.produto;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.dosagem !== undefined) row.dosagem = data.dosagem;
  if (data.classe !== undefined) row.classe = data.classe;
  if (data.quantidade !== undefined) row.quantidade = data.quantidade;
  if (data.unidade !== undefined) row.unidade = data.unidade;
  if (data.lote !== undefined) row.lote = data.lote;
  if (data.validade !== undefined) row.validade = data.validade;
  if (data.validadeEnsaioLaboratorial !== undefined) row.validade_ensaio_laboratorial = data.validadeEnsaioLaboratorial;
  if (data.validadeEnsaioFogo !== undefined) row.validade_ensaio_fogo = data.validadeEnsaioFogo;
  if (data.fabricacao !== undefined) row.fabricacao = data.fabricacao;
  if (data.composicao !== undefined) row.composicao = data.composicao;
  if (data.testeHidrostatico !== undefined) row.teste_hidrostatico = data.testeHidrostatico;
  if (data.validadeTesteHidrostatico !== undefined) row.validade_teste_hidrostatico = data.validadeTesteHidrostatico;
  if (data.validadeCilindro !== undefined) row.validade_cilindro = data.validadeCilindro;
  if (data.localizacao !== undefined) row.localizacao = data.localizacao;
  if (data.status !== undefined) row.status = data.status;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export async function listarAgentesExtintores(): Promise<AgenteExtintor[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToAgenteExtintor);
}

export async function criarAgenteExtintor(
  data: Omit<AgenteExtintor, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<AgenteExtintor> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...agenteExtintorToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToAgenteExtintor(created);
}

export async function atualizarAgenteExtintor(
  id: string,
  data: Partial<AgenteExtintor>,
): Promise<AgenteExtintor> {
  const db = getDb();
  const row = { ...agenteExtintorToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToAgenteExtintor(updated);
}

export async function excluirAgenteExtintor(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
