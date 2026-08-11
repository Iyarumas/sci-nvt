import { supabase } from '../lib/supabase';
import type { LRO } from '../types/lro';

const TABLE = 'registros_lro';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function parseJSON(val: unknown): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

function rowToLRO(row: Record<string, unknown>): LRO {
  return {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    equipe: (row.equipe as string) || '',
    turno: (row.turno as string) || '',
    dataEntrada: (row.data_entrada as string) || '',
    dataSaida: (row.data_saida as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    apoc: (row.apoc as string) || '',
    cci02Slots: parseJSON(row.cci02_slots) || [],
    cci03Slots: parseJSON(row.cci03_slots) || [],
    crsSlots: parseJSON(row.crs_slots) || [],
    apoioOutrosSlots: parseJSON(row.apoio_outros_slots) || [],
    substituicoesAtivo: !!row.substituicoes_ativo,
    substituicoes: parseJSON(row.substituicoes) || [],
    instrucoes: (row.instrucoes as string) || '',
    faisca2: parseJSON(row.faisca2) || {},
    faisca3: parseJSON(row.faisca3) || {},
    faiscaRT: parseJSON(row.faisca_rt) || {},
    crs: parseJSON(row.crs) || {},
    situacaoCentralFaisca: (row.situacao_central_faisca as string) || '',
    situacaoComunicacao: (row.situacao_comunicacao as string) || '',
    situacaoTPEPR: (row.situacao_tpepr as string) || '',
    situacaoAgentesExtintores: (row.situacao_agentes_extintores as string) || '',
    situacaoEquipamentos: (row.situacao_equipamentos as string) || '',
    situacaoEdificacoes: (row.situacao_edificacoes as string) || '',
    inspecoesTecnicas: (row.inspecoes_tecnicas as string) || '',
    emergenciasAeronauticas: (row.emergencias_aeronauticas as string) || '',
    outrasOcorrencias: (row.outras_ocorrencias as string) || '',
    assinatura: (row.assinatura as string) || '',
  };
}

export async function listarLROs(params?: {
  equipe?: string;
  createdBy?: string;
  dataEntradaGte?: string;
  dataEntradaLte?: string;
}): Promise<LRO[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.createdBy) query = query.eq('created_by', params.createdBy);
  if (params?.dataEntradaGte) query = query.gte('data_entrada', params.dataEntradaGte);
  if (params?.dataEntradaLte) query = query.lte('data_entrada', params.dataEntradaLte);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToLRO);
}

export async function listarLROsPorUsuario(username: string): Promise<LRO[]> {
  return listarLROs({ createdBy: username });
}

export async function obterLRO(id: string): Promise<LRO | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) return null;
  return data ? rowToLRO(data) : null;
}

export async function criarLRO(data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt'>): Promise<LRO> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    created_by: data.createdBy, created_at: now, updated_at: now,
    equipe: data.equipe, turno: data.turno,
    data_entrada: data.dataEntrada, data_saida: data.dataSaida,
    chefe_equipe: data.chefeEquipe, apoc: data.apoc,
    cci02_slots: data.cci02Slots, cci03_slots: data.cci03Slots,
    crs_slots: data.crsSlots, apoio_outros_slots: data.apoioOutrosSlots,
    substituicoes_ativo: data.substituicoesAtivo, substituicoes: data.substituicoes,
    instrucoes: data.instrucoes,
    faisca2: data.faisca2, faisca3: data.faisca3,
    faisca_rt: data.faiscaRT, crs: data.crs,
    situacao_central_faisca: data.situacaoCentralFaisca, situacao_comunicacao: data.situacaoComunicacao,
    situacao_tpepr: data.situacaoTPEPR, situacao_agentes_extintores: data.situacaoAgentesExtintores,
    situacao_equipamentos: data.situacaoEquipamentos, situacao_edificacoes: data.situacaoEdificacoes,
    inspecoes_tecnicas: data.inspecoesTecnicas, emergencias_aeronauticas: data.emergenciasAeronauticas,
    outras_ocorrencias: data.outrasOcorrencias, assinatura: data.assinatura,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return rowToLRO(created);
}

export async function atualizarLRO(id: string, data: Partial<LRO>): Promise<LRO | null> {
  const db = getDb();
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.equipe !== undefined) r.equipe = data.equipe;
  if (data.turno !== undefined) r.turno = data.turno;
  if (data.dataEntrada !== undefined) r.data_entrada = data.dataEntrada;
  if (data.dataSaida !== undefined) r.data_saida = data.dataSaida;
  if (data.chefeEquipe !== undefined) r.chefe_equipe = data.chefeEquipe;
  if (data.apoc !== undefined) r.apoc = data.apoc;
  if (data.cci02Slots !== undefined) r.cci02_slots = data.cci02Slots;
  if (data.cci03Slots !== undefined) r.cci03_slots = data.cci03Slots;
  if (data.crsSlots !== undefined) r.crs_slots = data.crsSlots;
  if (data.apoioOutrosSlots !== undefined) r.apoio_outros_slots = data.apoioOutrosSlots;
  if (data.substituicoesAtivo !== undefined) r.substituicoes_ativo = data.substituicoesAtivo;
  if (data.substituicoes !== undefined) r.substituicoes = data.substituicoes;
  if (data.instrucoes !== undefined) r.instrucoes = data.instrucoes;
  if (data.faisca2 !== undefined) r.faisca2 = data.faisca2;
  if (data.faisca3 !== undefined) r.faisca3 = data.faisca3;
  if (data.faiscaRT !== undefined) r.faisca_rt = data.faiscaRT;
  if (data.crs !== undefined) r.crs = data.crs;
  if (data.situacaoCentralFaisca !== undefined) r.situacao_central_faisca = data.situacaoCentralFaisca;
  if (data.situacaoComunicacao !== undefined) r.situacao_comunicacao = data.situacaoComunicacao;
  if (data.situacaoTPEPR !== undefined) r.situacao_tpepr = data.situacaoTPEPR;
  if (data.situacaoAgentesExtintores !== undefined) r.situacao_agentes_extintores = data.situacaoAgentesExtintores;
  if (data.situacaoEquipamentos !== undefined) r.situacao_equipamentos = data.situacaoEquipamentos;
  if (data.situacaoEdificacoes !== undefined) r.situacao_edificacoes = data.situacaoEdificacoes;
  if (data.inspecoesTecnicas !== undefined) r.inspecoes_tecnicas = data.inspecoesTecnicas;
  if (data.emergenciasAeronauticas !== undefined) r.emergencias_aeronauticas = data.emergenciasAeronauticas;
  if (data.outrasOcorrencias !== undefined) r.outras_ocorrencias = data.outrasOcorrencias;
  if (data.assinatura !== undefined) r.assinatura = data.assinatura;
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) throw error;
  return updated ? rowToLRO(updated) : null;
}

export async function excluirLRO(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}
