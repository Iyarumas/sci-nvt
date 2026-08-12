import { supabase } from '../lib/supabase';
import type { Bombeiro, Cargo } from '../types/bombeiro';
import { listarAtivos } from './bombeiroService';
import { criarVagaPendente } from './vagaPendenteService';

const TABLE = 'vigencia_substituicoes';

export type MotivoVigenciaSubstituicao = 'ferias' | 'afastamento' | 'substituicao' | 'cascata';

export interface VigenciaSubstituicao {
  id: string;
  substitutoId: string;
  substitutoNome: string;
  cargoOriginalSubstituto: string;
  cargoExercido: string;
  funcionarioOriginalId: string;
  funcionarioOriginalNome: string;
  cargoOriginalFuncionario: string;
  equipe: string;
  dataInicio: string;
  dataFim: string;
  nivelCascata: number;
  motivo: MotivoVigenciaSubstituicao;
  feriasId: string;
  ativa: boolean;
  createdAt: string;
}

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

function rowToVigencia(row: Record<string, unknown>): VigenciaSubstituicao {
  return {
    id: row.id as string,
    substitutoId: (row.substituto_id as string) || '',
    substitutoNome: (row.substituto_nome as string) || '',
    cargoOriginalSubstituto: (row.cargo_original_substituto as string) || '',
    cargoExercido: (row.cargo_exercido as string) || '',
    funcionarioOriginalId: (row.funcionario_original_id as string) || '',
    funcionarioOriginalNome: (row.funcionario_original_nome as string) || '',
    cargoOriginalFuncionario: (row.cargo_original_funcionario as string) || '',
    equipe: (row.equipe as string) || '',
    dataInicio: (row.data_inicio as string) || '',
    dataFim: (row.data_fim as string) || '',
    nivelCascata: (row.nivel_cascata as number) || 1,
    motivo: (row.motivo as MotivoVigenciaSubstituicao) || 'ferias',
    feriasId: (row.ferias_id as string) || '',
    ativa: row.ativa !== false,
    createdAt: (row.created_at as string) || '',
  };
}

// ── CRUD Básico ──────────────────────────────────────────────────

export async function listarVigencias(params?: {
  equipe?: string;
  dataInicio?: string;
  dataFim?: string;
  ativa?: boolean;
  substitutoId?: string;
  feriasId?: string;
}): Promise<VigenciaSubstituicao[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');

  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.dataInicio) query = query.gte('data_fim', params.dataInicio);
  if (params?.dataFim) query = query.lte('data_inicio', params.dataFim);
  // Nunca retornar vigências cujo período já expirou
  query = query.gte('data_fim', new Date().toISOString().split('T')[0]);
  if (params?.ativa !== undefined) query = query.eq('ativa', params.ativa);
  if (params?.substitutoId) query = query.eq('substituto_id', params.substitutoId);
  if (params?.feriasId) query = query.eq('ferias_id', params.feriasId);

  query = query.order('nivel_cascata', { ascending: true });

  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToVigencia);
}

export async function criarVigencia(
  data: Omit<VigenciaSubstituicao, 'id' | 'createdAt'>,
): Promise<VigenciaSubstituicao> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    substituto_id: data.substitutoId,
    substituto_nome: data.substitutoNome,
    cargo_original_substituto: data.cargoOriginalSubstituto,
    cargo_exercido: data.cargoExercido,
    funcionario_original_id: data.funcionarioOriginalId,
    funcionario_original_nome: data.funcionarioOriginalNome,
    cargo_original_funcionario: data.cargoOriginalFuncionario,
    equipe: data.equipe,
    data_inicio: data.dataInicio,
    data_fim: data.dataFim,
    nivel_cascata: data.nivelCascata,
    motivo: data.motivo,
    ferias_id: data.feriasId,
    ativa: data.ativa !== false,
    created_at: now,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToVigencia(created);
}

export async function desativarVigencias(feriasId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from(TABLE)
    .update({ ativa: false })
    .eq('ferias_id', feriasId);
  if (error) handleSupabaseError(error);
}

export async function desativarVigenciasPorSubstituto(substitutoId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from(TABLE)
    .update({ ativa: false })
    .eq('substituto_id', substitutoId);
  if (error) handleSupabaseError(error);
}

// ── Corrente de Substituição (substituto → substituto → ... → Ferista) ─

export interface EloCadeiaInput {
  pessoaId: string;
  pessoaNome: string;
  cargoOriginal: Cargo;
  cargoVacante: string;       // cargo que está a ser coberto (ex: BA-MC)
  substituindoNome: string;   // nome de quem está a ser substituído
}

/**
 * Processa a corrente de substituição na BD a partir dos elos definidos
 * manualmente pelo utilizador no modal.
 */
export async function processarCadeiaSubstituicao(
  feriasRecord: {
    id: string;
    funcionarioId: string;
    funcionarioNome: string;
    equipe: string;
    substitutoId?: string;
    substitutoNome?: string;
    funcaoSubstituicao?: string;
    dataInicio: string;
    dataFim: string;
    motivoOrigem?: Exclude<MotivoVigenciaSubstituicao, 'cascata'>;
  },
  cadeiaInput?: EloCadeiaInput[],
  bombeiros?: Bombeiro[],
): Promise<VigenciaSubstituicao[]> {
  const criadas: VigenciaSubstituicao[] = [];
  if (!feriasRecord.substitutoId) return criadas;

  await desativarVigencias(feriasRecord.id);
  if (!bombeiros) {
    bombeiros = await listarAtivos();
  }

  const substituto = bombeiros.find(b => b.id === feriasRecord.substitutoId);
  if (!substituto) return criadas;

  const funcionarioOriginal = bombeiros.find(b => b.id === feriasRecord.funcionarioId);
  const cargoFuncionario = (feriasRecord.funcaoSubstituicao || funcionarioOriginal?.cargo || 'BA-2') as Cargo;

  // --- Nível 1: Substituto direto ---
  const v1 = await criarVigencia({
    substitutoId: substituto.id,
    substitutoNome: substituto.nomeCompleto || feriasRecord.substitutoNome || '',
    cargoOriginalSubstituto: substituto.cargo,
    cargoExercido: cargoFuncionario,
    funcionarioOriginalId: feriasRecord.funcionarioId,
    funcionarioOriginalNome: feriasRecord.funcionarioNome,
    cargoOriginalFuncionario: cargoFuncionario,
    equipe: feriasRecord.equipe,
    dataInicio: feriasRecord.dataInicio,
    dataFim: feriasRecord.dataFim,
    nivelCascata: 1,
    motivo: feriasRecord.motivoOrigem || 'ferias',
    feriasId: feriasRecord.id,
    ativa: true,
  });
  criadas.push(v1);

  // Se o substituto é de outra equipa, não-Ferista
  if (substituto.equipe !== 'Ferista' && substituto.equipe !== feriasRecord.equipe) {
    await criarVigencia({
      substitutoId: substituto.id,
      substitutoNome: substituto.nomeCompleto || '',
      cargoOriginalSubstituto: substituto.cargo,
      cargoExercido: substituto.cargo,
      funcionarioOriginalId: substituto.id,
      funcionarioOriginalNome: substituto.nomeCompleto || '',
      cargoOriginalFuncionario: substituto.cargo,
      equipe: substituto.equipe,
      dataInicio: feriasRecord.dataInicio,
      dataFim: feriasRecord.dataFim,
      nivelCascata: 1,
      motivo: 'cascata',
      feriasId: feriasRecord.id,
      ativa: true,
    });
    await criarVagaPendente({
      equipe: substituto.equipe,
      cargo: substituto.cargo,
      dataInicio: feriasRecord.dataInicio,
      dataFim: feriasRecord.dataFim,
      funcionarioAusenteId: substituto.id,
      funcionarioAusenteNome: substituto.nomeCompleto || '',
      motivo: 'outra_equipe',
      cadeiaFeriasId: feriasRecord.id,
      preenchidoPorId: '',
      preenchidoPorNome: '',
      resolvido: false,
    });
  }

  // --- Nível 2+: Elos definidos manualmente pelo utilizador ---
  if (cadeiaInput && cadeiaInput.length > 0) {
    for (let i = 0; i < cadeiaInput.length; i++) {
      const elo = cadeiaInput[i];
      const funcionarioCobertoId = i === 0 ? substituto.id : cadeiaInput[i - 1].pessoaId;
      const funcionarioCoberto = bombeiros.find(b => b.id === funcionarioCobertoId);
      const v = await criarVigencia({
        substitutoId: elo.pessoaId,
        substitutoNome: elo.pessoaNome,
        cargoOriginalSubstituto: elo.cargoOriginal,
        cargoExercido: elo.cargoVacante,
        funcionarioOriginalId: funcionarioCobertoId,
        funcionarioOriginalNome: elo.substituindoNome,
        cargoOriginalFuncionario: elo.cargoVacante,
        equipe: funcionarioCoberto?.equipe || feriasRecord.equipe,
        dataInicio: feriasRecord.dataInicio,
        dataFim: feriasRecord.dataFim,
        nivelCascata: i + 2,
        motivo: 'cascata',
        feriasId: feriasRecord.id,
        ativa: true,
      });
      criadas.push(v);
    }
  }

  return criadas;
}

/**
 * @deprecated Usar processarCadeiaSubstituicao em vez desta.
 * Mantida para compatibilidade com aprovarEscalaEGerarGozos.
 */
export async function processarCascata(
  feriasRecord: {
    id: string;
    funcionarioId: string;
    funcionarioNome: string;
    equipe: string;
    substitutoId?: string;
    substitutoNome?: string;
    funcaoSubstituicao?: string;
    dataInicio: string;
    dataFim: string;
    motivoOrigem?: Exclude<MotivoVigenciaSubstituicao, 'cascata'>;
  },
  bombeiros?: Bombeiro[],
  _feriasGozo?: any[],
): Promise<VigenciaSubstituicao[]> {
  return processarCadeiaSubstituicao(feriasRecord, undefined, bombeiros);
}

// ── Helpers para resolução de efetivo ────────────────────────────

export interface EfetivoEquipe {
  bombeiro: Bombeiro;
  cargoExercido: string;
  substituindo: { id: string; nome: string; cargo: string } | null;
  emFerias: boolean;
  vigencias: VigenciaSubstituicao[];
}

/**
 * Retorna o efetivo REAL de uma equipa numa data específica,
 * considerando todas as substituições em vigor.
 */
export async function resolverEfetivo(
  equipe: string,
  data: string,
): Promise<{
  efetivos: EfetivoEquipe[];
  substitutosExternos: EfetivoEquipe[];
}> {
  const db = getDb();

  // Buscar membros da equipa + vigências no período
  const [bombeiros, vigenciasRaw] = await Promise.all([
    listarAtivos(),
    db.from(TABLE).select('*').eq('ativa', true),
  ]);

  if (vigenciasRaw.error) handleSupabaseError(vigenciasRaw.error);

  const vigencias = ((vigenciasRaw.data || []) as Record<string, unknown>[]).map(rowToVigencia);
  const bombeiroPorId = new Map(bombeiros.map(b => [b.id, b]));

  const equipeDaVaga = (v: VigenciaSubstituicao): string => {
    const original = bombeiroPorId.get(v.funcionarioOriginalId);
    return original?.equipe || v.equipe;
  };

  // Filtrar vigências do período
  const vigenciasPeriodo = vigencias.filter(v =>
    new Date(v.dataInicio) <= new Date(data) &&
    new Date(v.dataFim) >= new Date(data)
  );
  const vigenciasDaEquipe = vigenciasPeriodo.filter(v => equipeDaVaga(v) === equipe);
  const vigenciasReais = vigenciasDaEquipe.filter(v => v.substitutoId && v.substitutoId !== v.funcionarioOriginalId);
  const vigenciasAuto = vigenciasDaEquipe.filter(v => v.substitutoId && v.substitutoId === v.funcionarioOriginalId);

  // Mapa: substitutoId → vigência que ele está a exercer
  const mapSubstituto = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasReais) {
    mapSubstituto.set(v.substitutoId, v);
  }

  // Mapa: funcionarioOriginalId → vigência (quem está a ser coberto)
  const mapOriginal = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasReais) {
    mapOriginal.set(v.funcionarioOriginalId, v);
  }

  const mapVagaAberta = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasAuto) {
    mapVagaAberta.set(v.funcionarioOriginalId, v);
  }

  const membros = bombeiros.filter(b =>
    b.equipe === equipe && !b.dataDesligamento
  );

  const efetivos: EfetivoEquipe[] = [];
  const substitutosExternos: EfetivoEquipe[] = [];

  const processados = new Set<string>();

  for (const m of membros) {
    // Verificar se este membro está a substituir alguém (está a fazer outra função)
    const vigenciaAtiva = mapSubstituto.get(m.id);

    if (vigenciaAtiva) {
      // Este membro está a substituir alguém DESTA equipa
      efetivos.push({
        bombeiro: m,
        cargoExercido: vigenciaAtiva.cargoExercido || m.cargo,
        substituindo: {
          id: vigenciaAtiva.funcionarioOriginalId,
          nome: vigenciaAtiva.funcionarioOriginalNome,
          cargo: vigenciaAtiva.cargoOriginalFuncionario,
        },
        emFerias: false,
        vigencias: [vigenciaAtiva],
      });
      processados.add(m.id);
    } else {
      // Membro normal (ou está a ser substituído)
      const sendoSubstituido = mapOriginal.get(m.id);
      const vagaAberta = mapVagaAberta.get(m.id);
      efetivos.push({
        bombeiro: m,
        cargoExercido: m.cargo,
        substituindo: null,
        emFerias: !!sendoSubstituido || !!vagaAberta,
        vigencias: [sendoSubstituido, vagaAberta].filter(Boolean) as VigenciaSubstituicao[],
      });
      processados.add(m.id);
    }
  }

  // Substitutos externos (pessoas de outras equipas que vieram substituir)
  for (const v of vigenciasReais) {
    if (!processados.has(v.substitutoId)) {
      const bombeiro = bombeiros.find(b => b.id === v.substitutoId);
      if (bombeiro) {
        substitutosExternos.push({
          bombeiro,
          cargoExercido: v.cargoExercido,
          substituindo: {
            id: v.funcionarioOriginalId,
            nome: v.funcionarioOriginalNome,
            cargo: v.cargoOriginalFuncionario,
          },
          emFerias: false,
          vigencias: [v],
        });
        processados.add(bombeiro.id);
      }
    }
  }

  return { efetivos, substitutosExternos };
}

/**
 * Função simples para verificar se uma pessoa está substituída (de férias)
 * e quem está no lugar dela.
 */
export async function quemSubstitui(
  bombeiroId: string,
  data: string,
): Promise<VigenciaSubstituicao | null> {
  const db = getDb();
  const { data: rows, error } = await db
    .from(TABLE)
    .select('*')
    .eq('funcionario_original_id', bombeiroId)
    .eq('ativa', true)
    .lte('data_inicio', data)
    .gte('data_fim', data)
    .order('nivel_cascata', { ascending: true })
    .limit(1);

  if (error) return null;
  if (!rows || rows.length === 0) return null;
  const real = (rows as Record<string, unknown>[]).find(row => row.substituto_id !== bombeiroId);
  return real ? rowToVigencia(real) : null;
}
