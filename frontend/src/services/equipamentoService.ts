import { supabase } from '../lib/supabase';
import type { Equipamento } from '../types/equipamento';

const TABLE = 'equipamentos_operacionais';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function rowToEquipamento(row: Record<string, unknown>): Equipamento {
  return {
    id: row.id as string,
    nome: (row.nome as string) || '',
    descricao: (row.descricao as string) || '',
    categoria: (row.categoria as Equipamento['categoria']) || 'dea',
    marca: (row.marca as string) || '',
    modelo: (row.modelo as string) || '',
    numeroSerie: (row.numero_serie as string) || '',
    dataAquisicao: (row.data_aquisicao as string) || '',
    dataValidade: (row.data_validade as string) || '',
    vidaUtilMeses: (row.vida_util_meses as string) || '',
    responsavel: (row.responsavel as string) || '',
    responsavelId: row.responsavel_id as string | undefined,
    responsavelTipo: row.responsavel_tipo as 'bombeiro' | 'apoc' | undefined,
    localizacao: (row.localizacao as string) || '',
    status: (row.status as Equipamento['status']) || 'Operacional',
    fotoUrl: (row.foto_url as string) || '',
    observacoes: (row.observacoes as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function toRow(data: Partial<Equipamento>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (data.nome !== undefined) r.nome = data.nome;
  if (data.descricao !== undefined) r.descricao = data.descricao;
  if (data.categoria !== undefined) r.categoria = data.categoria;
  if (data.marca !== undefined) r.marca = data.marca;
  if (data.modelo !== undefined) r.modelo = data.modelo;
  if (data.numeroSerie !== undefined) r.numero_serie = data.numeroSerie;
  if (data.dataAquisicao !== undefined) r.data_aquisicao = data.dataAquisicao;
  if (data.dataValidade !== undefined) r.data_validade = data.dataValidade;
  if (data.vidaUtilMeses !== undefined) r.vida_util_meses = data.vidaUtilMeses;
  if (data.responsavel !== undefined) r.responsavel = data.responsavel;
  if (data.responsavelId !== undefined) r.responsavel_id = data.responsavelId;
  if (data.responsavelTipo !== undefined) r.responsavel_tipo = data.responsavelTipo;
  if (data.localizacao !== undefined) r.localizacao = data.localizacao;
  if (data.status !== undefined) r.status = data.status;
  if (data.fotoUrl !== undefined) r.foto_url = data.fotoUrl;
  if (data.observacoes !== undefined) r.observacoes = data.observacoes;
  r.updated_at = new Date().toISOString();
  return r;
}

export async function listarEquipamentos(): Promise<Equipamento[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*');
  if (error) throw error;
  return (data || []).map(rowToEquipamento);
}

export async function equipamentosPorCategoria(categoria: string): Promise<Equipamento[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('categoria', categoria);
  if (error) throw error;
  return (data || []).map(rowToEquipamento);
}

export async function criarEquipamento(data: Omit<Equipamento, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipamento> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...toRow(data), created_by: data.createdBy || '', created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToEquipamento(created);
}

export async function atualizarEquipamento(id: string, data: Partial<Equipamento>): Promise<Equipamento | null> {
  const db = getDb();
  const r = toRow(data);
  r.updated_at = new Date().toISOString();
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) throw error;
  return updated ? rowToEquipamento(updated) : null;
}

export async function excluirEquipamento(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}
