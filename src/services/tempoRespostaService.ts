import { supabase } from '../lib/supabase';
import type { TreinamentoTempoResposta } from '../types/tempoResposta';

const TABLE = 'treinamentos_tempo_resposta';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg = err instanceof Error ? err.message : 'Erro inesperado no banco de dados';
  throw new Error(msg);
}

function rowToItem(row: Record<string, unknown>): TreinamentoTempoResposta {
  return {
    id: row.id as string,
    equipe: (row.equipe as string) || '',
    numero: (row.numero as number) || 0,
    ano: (row.ano as string) || '',
    data: (row.data as string) || '',
    hora: (row.hora as string) || '',
    local: (row.local as string) || '',
    f2Cci: (row.f2_cci as string) || '',
    f2BaMc: (row.f2_ba_mc as string) || '',
    f2BaCe: (row.f2_ba_ce as string) || '',
    f2Ba2: (row.f2_ba2 as string) || '',
    f2T1: (row.f2_t1 as string) || '',
    f2T2: (row.f2_t2 as string) || '',
    f2T3: (row.f2_t3 as string) || '',
    f2Conceito: (row.f2_conceito as string) || '',
    f2Performance: (row.f2_performance as string) || '',
    f3Cci: (row.f3_cci as string) || '',
    f3BaMc: (row.f3_ba_mc as string) || '',
    f3Ba21: (row.f3_ba2_1 as string) || '',
    f3Ba22: (row.f3_ba2_2 as string) || '',
    f3T1: (row.f3_t1 as string) || '',
    f3T2: (row.f3_t2 as string) || '',
    f3T3: (row.f3_t3 as string) || '',
    f3Conceito: (row.f3_conceito as string) || '',
    f3Performance: (row.f3_performance as string) || '',
    observacoes: (row.observacoes as string) || '',
    resumoExercicio: (row.resumo_exercicio as string) || '',
    consideracoesFinais: (row.consideracoes_finais as string) || '',
    coordenacaoTwrSpeSci: (row.coordenacao_twr_spe_sci as string) || '',
    acionamento: (row.acionamento as string) || '',
    sistemaAlarmes: (row.sistema_alarmes as string) || '',
    comunicacaoFraseologia: (row.comunicacao_fraseologia as string) || '',
    deslocamentoVtrs: (row.deslocamento_vtrs as string) || '',
    visibilidadeSuperficie: (row.visibilidade_superficie as string) || '',
    procedimentoPcinc: (row.procedimento_pcinc as string) || '',
    tempoResposta: (row.tempo_resposta as string) || '',
    feedbackSpe: (row.feedback_spe as string) || '',
    feedbackTwr: (row.feedback_twr as string) || '',
    feedbackSci: (row.feedback_sci as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    gerente: (row.gerente as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

export async function listarTreinos(params?: {
  equipe?: string;
  ano?: string;
}): Promise<TreinamentoTempoResposta[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('numero', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.ano) query = query.eq('ano', params.ano);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToItem);
}

export async function obterTreino(id: string): Promise<TreinamentoTempoResposta | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) handleSupabaseError(error);
  return data ? rowToItem(data) : null;
}

export async function obterProximoNumero(ano: string): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('numero')
    .eq('ano', ano)
    .order('numero', { ascending: false })
    .limit(1);
  if (error) handleSupabaseError(error);
  return (data && data.length > 0 ? data[0].numero + 1 : 1);
}

export async function criarTreino(
  data: Omit<TreinamentoTempoResposta, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TreinamentoTempoResposta> {
  const db = getDb();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    equipe: data.equipe,
    numero: data.numero,
    ano: data.ano,
    data: data.data,
    hora: data.hora,
    local: data.local,
    f2_cci: data.f2Cci,
    f2_ba_mc: data.f2BaMc,
    f2_ba_ce: data.f2BaCe,
    f2_ba2: data.f2Ba2,
    f2_t1: data.f2T1,
    f2_t2: data.f2T2,
    f2_t3: data.f2T3,
    f2_conceito: data.f2Conceito,
    f2_performance: data.f2Performance,
    f3_cci: data.f3Cci,
    f3_ba_mc: data.f3BaMc,
    f3_ba2_1: data.f3Ba21,
    f3_ba2_2: data.f3Ba22,
    f3_t1: data.f3T1,
    f3_t2: data.f3T2,
    f3_t3: data.f3T3,
    f3_conceito: data.f3Conceito,
    f3_performance: data.f3Performance,
    observacoes: data.observacoes,
    resumo_exercicio: data.resumoExercicio,
    consideracoes_finais: data.consideracoesFinais,
    coordenacao_twr_spe_sci: data.coordenacaoTwrSpeSci,
    acionamento: data.acionamento,
    sistema_alarmes: data.sistemaAlarmes,
    comunicacao_fraseologia: data.comunicacaoFraseologia,
    deslocamento_vtrs: data.deslocamentoVtrs,
    visibilidade_superficie: data.visibilidadeSuperficie,
    procedimento_pcinc: data.procedimentoPcinc,
    tempo_resposta: data.tempoResposta,
    feedback_spe: data.feedbackSpe,
    feedback_twr: data.feedbackTwr,
    feedback_sci: data.feedbackSci,
    chefe_equipe: data.chefeEquipe,
    gerente: data.gerente,
    created_at: now,
    updated_at: now,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToItem(created);
}

export async function atualizarTreino(
  id: string,
  data: Partial<TreinamentoTempoResposta>,
): Promise<TreinamentoTempoResposta | null> {
  const db = getDb();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.equipe !== undefined) row.equipe = data.equipe;
  if (data.numero !== undefined) row.numero = data.numero;
  if (data.ano !== undefined) row.ano = data.ano;
  if (data.data !== undefined) row.data = data.data;
  if (data.hora !== undefined) row.hora = data.hora;
  if (data.local !== undefined) row.local = data.local;
  if (data.f2Cci !== undefined) row.f2_cci = data.f2Cci;
  if (data.f2BaMc !== undefined) row.f2_ba_mc = data.f2BaMc;
  if (data.f2BaCe !== undefined) row.f2_ba_ce = data.f2BaCe;
  if (data.f2Ba2 !== undefined) row.f2_ba2 = data.f2Ba2;
  if (data.f2T1 !== undefined) row.f2_t1 = data.f2T1;
  if (data.f2T2 !== undefined) row.f2_t2 = data.f2T2;
  if (data.f2T3 !== undefined) row.f2_t3 = data.f2T3;
  if (data.f2Conceito !== undefined) row.f2_conceito = data.f2Conceito;
  if (data.f2Performance !== undefined) row.f2_performance = data.f2Performance;
  if (data.f3Cci !== undefined) row.f3_cci = data.f3Cci;
  if (data.f3BaMc !== undefined) row.f3_ba_mc = data.f3BaMc;
  if (data.f3Ba21 !== undefined) row.f3_ba2_1 = data.f3Ba21;
  if (data.f3Ba22 !== undefined) row.f3_ba2_2 = data.f3Ba22;
  if (data.f3T1 !== undefined) row.f3_t1 = data.f3T1;
  if (data.f3T2 !== undefined) row.f3_t2 = data.f3T2;
  if (data.f3T3 !== undefined) row.f3_t3 = data.f3T3;
  if (data.f3Conceito !== undefined) row.f3_conceito = data.f3Conceito;
  if (data.f3Performance !== undefined) row.f3_performance = data.f3Performance;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.resumoExercicio !== undefined) row.resumo_exercicio = data.resumoExercicio;
  if (data.consideracoesFinais !== undefined) row.consideracoes_finais = data.consideracoesFinais;
  if (data.coordenacaoTwrSpeSci !== undefined) row.coordenacao_twr_spe_sci = data.coordenacaoTwrSpeSci;
  if (data.acionamento !== undefined) row.acionamento = data.acionamento;
  if (data.sistemaAlarmes !== undefined) row.sistema_alarmes = data.sistemaAlarmes;
  if (data.comunicacaoFraseologia !== undefined) row.comunicacao_fraseologia = data.comunicacaoFraseologia;
  if (data.deslocamentoVtrs !== undefined) row.deslocamento_vtrs = data.deslocamentoVtrs;
  if (data.visibilidadeSuperficie !== undefined) row.visibilidade_superficie = data.visibilidadeSuperficie;
  if (data.procedimentoPcinc !== undefined) row.procedimento_pcinc = data.procedimentoPcinc;
  if (data.tempoResposta !== undefined) row.tempo_resposta = data.tempoResposta;
  if (data.feedbackSpe !== undefined) row.feedback_spe = data.feedbackSpe;
  if (data.feedbackTwr !== undefined) row.feedback_twr = data.feedbackTwr;
  if (data.feedbackSci !== undefined) row.feedback_sci = data.feedbackSci;
  if (data.chefeEquipe !== undefined) row.chefe_equipe = data.chefeEquipe;
  if (data.gerente !== undefined) row.gerente = data.gerente;
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToItem(updated) : null;
}

export async function excluirTreino(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
