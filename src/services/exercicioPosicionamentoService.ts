import { supabase } from '../lib/supabase';
import type { ExercicioPosicionamento } from '../types/exercicioPosicionamento';

const TABLE = 'exercicios_posicionamento';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg = err instanceof Error ? err.message : 'Erro inesperado no banco de dados';
  throw new Error(msg);
}

function rowToExercicio(row: Record<string, unknown>): ExercicioPosicionamento {
  return {
    id: row.id as string,
    equipe: (row.equipe as string) || '',
    numero: (row.numero as number) || 0,
    ano: (row.ano as string) || '',
    data: (row.data as string) || '',
    hora: (row.hora as string) || '',
    local: (row.local as string) || '',
    faisca2BaMc: (row.faisca2_ba_mc as string) || '',
    faisca2BaCe: (row.faisca2_ba_ce as string) || '',
    faisca2Ba2: (row.faisca2_ba2 as string) || '',
    faisca2Tempo: (row.faisca2_tempo as string) || '',
    faisca3BaMc: (row.faisca3_ba_mc as string) || '',
    faisca3Ba21: (row.faisca3_ba2_1 as string) || '',
    faisca3Ba22: (row.faisca3_ba2_2 as string) || '',
    faisca3Tempo: (row.faisca3_tempo as string) || '',
    crsBaMc: (row.crs_ba_mc as string) || '',
    crsBaLr: (row.crs_ba_lr as string) || '',
    crsBaRe1: (row.crs_ba_re1 as string) || '',
    crsBaRe2: (row.crs_ba_re2 as string) || '',
    crsTempo: (row.crs_tempo as string) || '',
    operadorComunicacoes: (row.operador_comunicacoes as string) || '',
    observacoes: (row.observacoes as string) || '',
    coordenacaoTwrCoeSci: (row.coordenacao_twr_coe_sci as string) || '',
    comunicacaoFraseologia: (row.comunicacao_fraseologia as string) || '',
    procedimentosPcinc: (row.procedimentos_pcinc as string) || '',
    feedbackTwr: (row.feedback_twr as string) || '',
    resumoExercicio: (row.resumo_exercicio as string) || '',
    acionamento: (row.acionamento as string) || '',
    deslocamentoVtrs: (row.deslocamento_vtrs as string) || '',
    tempoResposta: (row.tempo_resposta as string) || '',
    feedbackSci: (row.feedback_sci as string) || '',
    consideracoesFinais: (row.consideracoes_finais as string) || '',
    sistemaAlarmes: (row.sistema_alarmes as string) || '',
    visibilidadeSuperficie: (row.visibilidade_superficie as string) || '',
    feedbackCoe: (row.feedback_coe as string) || '',
    chefeEquipe: (row.chefe_equipe as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

export async function listarExercicios(params?: {
  equipe?: string;
  ano?: string;
}): Promise<ExercicioPosicionamento[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('numero', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.ano) query = query.eq('ano', params.ano);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToExercicio);
}

export async function obterExercicio(id: string): Promise<ExercicioPosicionamento | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) handleSupabaseError(error);
  return data ? rowToExercicio(data) : null;
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

export async function criarExercicio(
  data: Omit<ExercicioPosicionamento, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ExercicioPosicionamento> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data: created, error } = await db
    .from(TABLE)
    .insert({
      equipe: data.equipe,
      numero: data.numero,
      ano: data.ano,
      data: data.data,
      hora: data.hora,
      local: data.local,
      faisca2_ba_mc: data.faisca2BaMc,
      faisca2_ba_ce: data.faisca2BaCe,
      faisca2_ba2: data.faisca2Ba2,
      faisca2_tempo: data.faisca2Tempo,
      faisca3_ba_mc: data.faisca3BaMc,
      faisca3_ba2_1: data.faisca3Ba21,
      faisca3_ba2_2: data.faisca3Ba22,
      faisca3_tempo: data.faisca3Tempo,
      crs_ba_mc: data.crsBaMc,
      crs_ba_lr: data.crsBaLr,
      crs_ba_re1: data.crsBaRe1,
      crs_ba_re2: data.crsBaRe2,
      crs_tempo: data.crsTempo,
      operador_comunicacoes: data.operadorComunicacoes,
      observacoes: data.observacoes,
      coordenacao_twr_coe_sci: data.coordenacaoTwrCoeSci,
      comunicacao_fraseologia: data.comunicacaoFraseologia,
      procedimentos_pcinc: data.procedimentosPcinc,
      feedback_twr: data.feedbackTwr,
      resumo_exercicio: data.resumoExercicio,
      acionamento: data.acionamento,
      deslocamento_vtrs: data.deslocamentoVtrs,
      tempo_resposta: data.tempoResposta,
      feedback_sci: data.feedbackSci,
      consideracoes_finais: data.consideracoesFinais,
      sistema_alarmes: data.sistemaAlarmes,
      visibilidade_superficie: data.visibilidadeSuperficie,
      feedback_coe: data.feedbackCoe,
      chefe_equipe: data.chefeEquipe,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return rowToExercicio(created);
}

export async function atualizarExercicio(
  id: string,
  data: Partial<ExercicioPosicionamento>,
): Promise<ExercicioPosicionamento | null> {
  const db = getDb();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.equipe !== undefined) row.equipe = data.equipe;
  if (data.numero !== undefined) row.numero = data.numero;
  if (data.ano !== undefined) row.ano = data.ano;
  if (data.data !== undefined) row.data = data.data;
  if (data.hora !== undefined) row.hora = data.hora;
  if (data.local !== undefined) row.local = data.local;
  if (data.faisca2BaMc !== undefined) row.faisca2_ba_mc = data.faisca2BaMc;
  if (data.faisca2BaCe !== undefined) row.faisca2_ba_ce = data.faisca2BaCe;
  if (data.faisca2Ba2 !== undefined) row.faisca2_ba2 = data.faisca2Ba2;
  if (data.faisca2Tempo !== undefined) row.faisca2_tempo = data.faisca2Tempo;
  if (data.faisca3BaMc !== undefined) row.faisca3_ba_mc = data.faisca3BaMc;
  if (data.faisca3Ba21 !== undefined) row.faisca3_ba2_1 = data.faisca3Ba21;
  if (data.faisca3Ba22 !== undefined) row.faisca3_ba2_2 = data.faisca3Ba22;
  if (data.faisca3Tempo !== undefined) row.faisca3_tempo = data.faisca3Tempo;
  if (data.crsBaMc !== undefined) row.crs_ba_mc = data.crsBaMc;
  if (data.crsBaLr !== undefined) row.crs_ba_lr = data.crsBaLr;
  if (data.crsBaRe1 !== undefined) row.crs_ba_re1 = data.crsBaRe1;
  if (data.crsBaRe2 !== undefined) row.crs_ba_re2 = data.crsBaRe2;
  if (data.crsTempo !== undefined) row.crs_tempo = data.crsTempo;
  if (data.operadorComunicacoes !== undefined) row.operador_comunicacoes = data.operadorComunicacoes;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.coordenacaoTwrCoeSci !== undefined) row.coordenacao_twr_coe_sci = data.coordenacaoTwrCoeSci;
  if (data.comunicacaoFraseologia !== undefined) row.comunicacao_fraseologia = data.comunicacaoFraseologia;
  if (data.procedimentosPcinc !== undefined) row.procedimentos_pcinc = data.procedimentosPcinc;
  if (data.feedbackTwr !== undefined) row.feedback_twr = data.feedbackTwr;
  if (data.resumoExercicio !== undefined) row.resumo_exercicio = data.resumoExercicio;
  if (data.acionamento !== undefined) row.acionamento = data.acionamento;
  if (data.deslocamentoVtrs !== undefined) row.deslocamento_vtrs = data.deslocamentoVtrs;
  if (data.tempoResposta !== undefined) row.tempo_resposta = data.tempoResposta;
  if (data.feedbackSci !== undefined) row.feedback_sci = data.feedbackSci;
  if (data.consideracoesFinais !== undefined) row.consideracoes_finais = data.consideracoesFinais;
  if (data.sistemaAlarmes !== undefined) row.sistema_alarmes = data.sistemaAlarmes;
  if (data.visibilidadeSuperficie !== undefined) row.visibilidade_superficie = data.visibilidadeSuperficie;
  if (data.feedbackCoe !== undefined) row.feedback_coe = data.feedbackCoe;
  if (data.chefeEquipe !== undefined) row.chefe_equipe = data.chefeEquipe;
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToExercicio(updated) : null;
}

export async function excluirExercicio(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
