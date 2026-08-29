import { supabase } from '../lib/supabase';
import type { Bombeiro, Cargo } from '../types/bombeiro';
import type { EloCadeiaSubstituicaoTemporaria, SubstituicaoTemporaria } from '../types/substituicaoTemporaria';
import {
  assertSemErros,
  validarSubstituicaoTemporaria,
} from '../utils/regrasOperacionais';
import { listarAtivos } from './bombeiroService';
import {
  desativarVigencias,
  processarCadeiaSubstituicao,
  type EloCadeiaInput,
} from './vigenciaSubstituicaoService';

const TABLE = 'substituicoes_temporarias';
const DATA_FIM_INDETERMINADO = '9999-12-31';

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

function normalizarTipo(tipo: unknown): SubstituicaoTemporaria['tipo'] {
  const value = String(tipo || '').trim().toLowerCase();
  if (value === 'extra') return 'Extra';
  if (value === 'afastamento') return 'Afastamento';
  return 'Substituição';
}

function normalizarPlantaoExtra(value: unknown): SubstituicaoTemporaria['plantaoExtra'] {
  if (value === true) return 'Sim';
  if (value === false) return 'Nao';
  const normalized = String(value || '').trim().toLowerCase();
  if (['sim', 's', 'true', 't', 'yes', 'y', '1'].includes(normalized)) return 'Sim';
  if (['nao', 'não', 'n', 'false', 'f', 'no', '0'].includes(normalized)) return 'Nao';
  if (value === 'Sim' || value === 'Nao') return value;
  return '';
}

function plantaoExtraToDb(value: SubstituicaoTemporaria['plantaoExtra'] | undefined): boolean {
  return value === 'Sim';
}

function jsonb(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function parseDataLocal(value: string): Date | null {
  const [ano, mes, dia] = value.split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

function dataLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function somarDias(dataISO: string, dias: number): string {
  const data = parseDataLocal(dataISO);
  if (!data) return '';
  data.setDate(data.getDate() + dias);
  return dataLocalISO(data);
}

function isAfastamentoIndeterminado(substituicao: Pick<SubstituicaoTemporaria, 'tipo' | 'motivo' | 'dataFim'>): boolean {
  return substituicao.tipo === 'Afastamento' &&
    (substituicao.motivo === 'INSS Indeterminado' || substituicao.dataFim === DATA_FIM_INDETERMINADO);
}

function temExtrasAfastamento(substituicao: Pick<SubstituicaoTemporaria, 'tipo' | 'cadeiaSubstituicao'>): boolean {
  return substituicao.tipo === 'Afastamento' &&
    substituicao.cadeiaSubstituicao.some(elo => elo.tipo === 'extra');
}

function dataInicioVigenciaFixa(substituicao: SubstituicaoTemporaria): string {
  if (!isAfastamentoIndeterminado(substituicao)) return substituicao.dataInicio;
  return somarDias(substituicao.dataInicio, Math.max(0, Number(substituicao.dias) || 0));
}

function deveProcessarVigencia(substituicao: SubstituicaoTemporaria): boolean {
  if (substituicao.tipo === 'Substituição') return true;
  if (isAfastamentoIndeterminado(substituicao)) return !!substituicao.substitutoId;
  return substituicao.tipo === 'Afastamento' && !temExtrasAfastamento(substituicao);
}

function parseCadeia(value: unknown): EloCadeiaSubstituicaoTemporaria[] {
  const parsed = typeof value === 'string'
    ? (() => { try { return JSON.parse(value); } catch { return []; } })()
    : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.map(item => {
    const elo = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const pessoaId = String(elo.pessoaId || elo.pessoa_id || elo.substitutoId || elo.substituto_id || '');
    const pessoaNome = String(elo.pessoaNome || elo.pessoa_nome || elo.substitutoNome || elo.substituto_nome || '');
    const pessoaCargo = String(elo.pessoaCargo || elo.pessoa_cargo || elo.substitutoCargo || elo.substituto_cargo || elo.cargoOriginal || elo.cargo_original || '');
    const pessoaEquipe = String(elo.pessoaEquipe || elo.pessoa_equipe || '');
    const funcionarioId = String(elo.funcionarioId || elo.funcionario_id || '');
    const funcionarioNome = String(elo.funcionarioNome || elo.funcionario_nome || '');
    const funcionarioCargo = String(elo.funcionarioCargo || elo.funcionario_cargo || '');
    const funcionarioEquipe = String(elo.funcionarioEquipe || elo.funcionario_equipe || '');
    const substitutoId = String(elo.substitutoId || elo.substituto_id || pessoaId);
    const substitutoNome = String(elo.substitutoNome || elo.substituto_nome || pessoaNome);
    const substitutoCargo = String(elo.substitutoCargo || elo.substituto_cargo || pessoaCargo);
    const dataPlantao = String(elo.dataPlantao || elo.data_plantao || '');
    const plantaoExtra = elo.plantaoExtra === true || elo.plantao_extra === true;
    const tipoRaw = String(elo.tipo || '').trim().toLowerCase();
    const tipo = tipoRaw === 'extra' || (plantaoExtra && dataPlantao) || (dataPlantao && substitutoId)
      ? 'extra'
      : 'cadeia';
    return {
      tipo: tipo as EloCadeiaSubstituicaoTemporaria['tipo'],
      pessoaId,
      pessoaNome,
      pessoaCargo,
      pessoaEquipe,
      cargoOriginal: String(elo.cargoOriginal || elo.cargo_original || pessoaCargo),
      cargoVacante: String(elo.cargoVacante || elo.cargo_vacante || ''),
      substituindoNome: String(elo.substituindoNome || elo.substituindo_nome || ''),
      dataPlantao,
      funcionarioId,
      funcionarioNome,
      funcionarioCargo,
      funcionarioEquipe,
      equipePlantao: String(elo.equipePlantao || elo.equipe_plantao || ''),
      substituindoId: String(elo.substituindoId || elo.substituindo_id || ''),
      substituindoCargo: String(elo.substituindoCargo || elo.substituindo_cargo || ''),
      substituindoCoberturaNome: String(elo.substituindoCoberturaNome || elo.substituindo_cobertura_nome || ''),
      substitutoId,
      substitutoNome,
      substitutoCargo,
      cargoExercido: String(elo.cargoExercido || elo.cargo_exercido || elo.cargoVacante || elo.cargo_vacante || ''),
      plantaoExtra,
    };
  }).filter(elo => elo.pessoaId || elo.substitutoId);
}

function rowToSubstituicao(row: Record<string, unknown>): SubstituicaoTemporaria {
  const tipo = normalizarTipo(row.tipo);
  return {
    id: row.id as string,
    funcionarioId: row.funcionario_id as string,
    funcionarioNome: row.funcionario_nome as string,
    funcionarioCargo: row.funcionario_cargo as string,
    substitutoId: row.substituto_id as string,
    substitutoNome: row.substituto_nome as string,
    substitutoCargo: row.substituto_cargo as string,
    tipo,
    motivo: row.motivo as SubstituicaoTemporaria['motivo'],
    motivoOutro: row.motivo_outro as string,
    plantaoExtra: tipo === 'Extra' || tipo === 'Afastamento' ? normalizarPlantaoExtra(row.plantao_extra) : '',
    dataInicio: row.data_inicio as string,
    dataFim: row.data_fim as string,
    dias: row.dias as number,
    status: row.status as SubstituicaoTemporaria['status'],
    observacoesRejeicao: row.observacoes_rejeicao as string,
    criadoPor: row.criado_por as string,
    criadoPorNome: row.criado_por_nome as string,
    aprovadoPor: row.aprovado_por as string,
    aprovadoPorNome: row.aprovado_por_nome as string,
    aprovadoEm: row.aprovado_em as string,
    cadeiaSubstituicao: parseCadeia(row.cadeia_substituicao),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function substituicaoToRow(data: Partial<SubstituicaoTemporaria>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.funcionarioId !== undefined) row.funcionario_id = data.funcionarioId;
  if (data.funcionarioNome !== undefined) row.funcionario_nome = data.funcionarioNome;
  if (data.funcionarioCargo !== undefined) row.funcionario_cargo = data.funcionarioCargo;
  if (data.substitutoId !== undefined) row.substituto_id = data.substitutoId;
  if (data.substitutoNome !== undefined) row.substituto_nome = data.substitutoNome;
  if (data.substitutoCargo !== undefined) row.substituto_cargo = data.substitutoCargo;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.plantaoExtra !== undefined) row.plantao_extra = plantaoExtraToDb(data.plantaoExtra);
  if (data.motivo !== undefined) row.motivo = data.motivo;
  if (data.motivoOutro !== undefined) row.motivo_outro = data.motivoOutro;
  if (data.dataInicio !== undefined) row.data_inicio = data.dataInicio;
  if (data.dataFim !== undefined) row.data_fim = data.dataFim;
  if (data.dias !== undefined) row.dias = data.dias;
  if (data.status !== undefined) row.status = data.status;
  if (data.observacoesRejeicao !== undefined) row.observacoes_rejeicao = data.observacoesRejeicao;
  if (data.criadoPor !== undefined) row.criado_por = data.criadoPor;
  if (data.criadoPorNome !== undefined) row.criado_por_nome = data.criadoPorNome;
  if (data.aprovadoPor !== undefined) row.aprovado_por = data.aprovadoPor;
  if (data.aprovadoPorNome !== undefined) row.aprovado_por_nome = data.aprovadoPorNome;
  if (data.aprovadoEm !== undefined) row.aprovado_em = data.aprovadoEm;
  if (data.cadeiaSubstituicao !== undefined) row.cadeia_substituicao = jsonb(data.cadeiaSubstituicao);
  return row;
}

function contextoValidacao(data: Pick<SubstituicaoTemporaria, 'funcionarioId' | 'substitutoId'>, bombeiros: Bombeiro[]) {
  return {
    bombeiros,
    funcionario: bombeiros.find(b => b.id === data.funcionarioId),
    substituto: bombeiros.find(b => b.id === data.substitutoId),
  };
}

async function processarVigenciasSubstituicaoTemporaria(
  substituicao: SubstituicaoTemporaria,
  bombeiros: Bombeiro[],
): Promise<void> {
  const funcionario = bombeiros.find(b => b.id === substituicao.funcionarioId);
  const dataInicioVigencia = dataInicioVigenciaFixa(substituicao);
  if (!dataInicioVigencia) return;
  const cadeiaInput: EloCadeiaInput[] = substituicao.cadeiaSubstituicao
    .filter(elo => elo.tipo !== 'extra')
    .map(elo => ({
      pessoaId: elo.pessoaId,
      pessoaNome: elo.pessoaNome,
      cargoOriginal: (elo.cargoOriginal || elo.pessoaCargo) as Cargo,
      cargoVacante: elo.cargoVacante,
      substituindoNome: elo.substituindoNome,
    }));

  await processarCadeiaSubstituicao({
    id: substituicao.id,
    funcionarioId: substituicao.funcionarioId,
    funcionarioNome: substituicao.funcionarioNome,
    equipe: funcionario?.equipe || '',
    substitutoId: substituicao.substitutoId,
    substitutoNome: substituicao.substitutoNome,
    funcaoSubstituicao: substituicao.funcionarioCargo,
    dataInicio: dataInicioVigencia,
    dataFim: substituicao.dataFim,
    motivoOrigem: substituicao.tipo === 'Afastamento' ? 'afastamento' : 'substituicao',
  }, substituicao.tipo === 'Afastamento' ? cadeiaInput : undefined, bombeiros);
}

export async function listarSubstituicoesTemporarias(): Promise<SubstituicaoTemporaria[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToSubstituicao);
}

export async function contarSubstituicoesPendentes(): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pendente');
  if (error) handleSupabaseError(error);
  return count || 0;
}

export async function criarSubstituicaoTemporaria(
  data: Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SubstituicaoTemporaria> {
  const db = getDb();
  const [existentes, bombeiros] = await Promise.all([
    listarSubstituicoesTemporarias(),
    listarAtivos(),
  ]);
  const contexto = contextoValidacao(data, bombeiros);
  assertSemErros(validarSubstituicaoTemporaria({
    substituicao: data,
    substituicoesExistentes: existentes,
    ...contexto,
  }));
  const now = new Date().toISOString();
  const row = {
    ...substituicaoToRow(data),
    created_at: now,
    updated_at: now,
  };
  const { data: created, error } = await db
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return rowToSubstituicao(created);
}

export async function atualizarSubstituicaoTemporaria(
  id: string,
  data: Partial<Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<SubstituicaoTemporaria | null> {
  const db = getDb();
  const { data: atualRaw, error: atualError } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (atualError) handleSupabaseError(atualError);

  const atual = rowToSubstituicao(atualRaw);
  const merged: SubstituicaoTemporaria = {
    ...atual,
    ...data,
    id: atual.id,
    createdAt: atual.createdAt,
    updatedAt: atual.updatedAt,
  };
  const [existentes, bombeiros] = await Promise.all([
    listarSubstituicoesTemporarias(),
    listarAtivos(),
  ]);
  const contexto = contextoValidacao(merged, bombeiros);
  assertSemErros(validarSubstituicaoTemporaria({
    substituicao: merged,
    substituicoesExistentes: existentes,
    ignoreSubstituicaoId: id,
    ...contexto,
  }));

  const now = new Date().toISOString();
  const deveReaprovar = atual.status === 'Aprovada';
  const dadosParaPersistir: Partial<Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'>> = deveReaprovar
    ? {
        ...data,
        status: 'Pendente',
        aprovadoPor: '',
        aprovadoPorNome: '',
        aprovadoEm: '',
      }
    : data;
  const row = {
    ...substituicaoToRow(dadosParaPersistir),
    updated_at: now,
  };
  const { data: updated, error } = await db
    .from(TABLE)
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);

  if (deveReaprovar) {
    await desativarVigencias(id);
  }

  const substituicaoAtualizada = updated ? rowToSubstituicao(updated) : null;
  if (!deveReaprovar && substituicaoAtualizada?.status === 'Aprovada') {
    await desativarVigencias(id);
    if (deveProcessarVigencia(substituicaoAtualizada)) {
      await processarVigenciasSubstituicaoTemporaria(substituicaoAtualizada, bombeiros);
    }
  }

  return substituicaoAtualizada;
}

export async function aprovarSubstituicaoTemporaria(
  id: string,
  aprovadoPor: string,
  aprovadoPorNome: string,
): Promise<SubstituicaoTemporaria | null> {
  const db = getDb();
  const { data: atualRaw, error: atualError } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (atualError) handleSupabaseError(atualError);
  const atual = rowToSubstituicao(atualRaw);
  if (atual.status !== 'Pendente') {
    throw new Error('Somente substituicoes pendentes podem ser aprovadas.');
  }
  const [existentes, bombeiros] = await Promise.all([
    listarSubstituicoesTemporarias(),
    listarAtivos(),
  ]);
  const contexto = contextoValidacao(atual, bombeiros);
  assertSemErros(validarSubstituicaoTemporaria({
    substituicao: { ...atual, status: 'Aprovada' },
    substituicoesExistentes: existentes,
    ignoreSubstituicaoId: id,
    ...contexto,
  }));
  const now = new Date().toISOString();
  const row = {
    status: 'Aprovada',
    aprovado_por: aprovadoPor,
    aprovado_por_nome: aprovadoPorNome,
    aprovado_em: now,
    updated_at: now,
  };
  const { data: updated, error } = await db
    .from(TABLE)
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  const aprovado = updated ? rowToSubstituicao(updated) : null;
  if (aprovado && deveProcessarVigencia(aprovado)) {
    try {
      await processarVigenciasSubstituicaoTemporaria(aprovado, bombeiros);
    } catch (err) {
      await desativarVigencias(id).catch(() => undefined);
      await db
        .from(TABLE)
        .update({
          status: 'Pendente',
          aprovado_por: '',
          aprovado_por_nome: '',
          aprovado_em: '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      throw err;
    }
  }
  return aprovado;
}

export async function rejeitarSubstituicaoTemporaria(
  id: string,
  aprovadoPor: string,
  aprovadoPorNome: string,
  observacoes: string,
): Promise<SubstituicaoTemporaria | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    status: 'Rejeitada',
    aprovado_por: aprovadoPor,
    aprovado_por_nome: aprovadoPorNome,
    observacoes_rejeicao: observacoes,
    aprovado_em: now,
    updated_at: now,
  };
  const { data: updated, error } = await db
    .from(TABLE)
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  await desativarVigencias(id);
  return updated ? rowToSubstituicao(updated) : null;
}

export async function excluirSubstituicaoTemporaria(id: string): Promise<boolean> {
  const db = getDb();
  await desativarVigencias(id);
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
