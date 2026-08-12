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

function parseCadeia(value: unknown): EloCadeiaSubstituicaoTemporaria[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const elo = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      pessoaId: String(elo.pessoaId || ''),
      pessoaNome: String(elo.pessoaNome || ''),
      pessoaCargo: String(elo.pessoaCargo || elo.cargoOriginal || ''),
      pessoaEquipe: String(elo.pessoaEquipe || ''),
      cargoOriginal: String(elo.cargoOriginal || elo.pessoaCargo || ''),
      cargoVacante: String(elo.cargoVacante || ''),
      substituindoNome: String(elo.substituindoNome || ''),
    };
  }).filter(elo => elo.pessoaId);
}

function rowToSubstituicao(row: Record<string, unknown>): SubstituicaoTemporaria {
  return {
    id: row.id as string,
    funcionarioId: row.funcionario_id as string,
    funcionarioNome: row.funcionario_nome as string,
    funcionarioCargo: row.funcionario_cargo as string,
    substitutoId: row.substituto_id as string,
    substitutoNome: row.substituto_nome as string,
    substitutoCargo: row.substituto_cargo as string,
    tipo: normalizarTipo(row.tipo),
    motivo: row.motivo as SubstituicaoTemporaria['motivo'],
    motivoOutro: row.motivo_outro as string,
    plantaoExtra: normalizarTipo(row.tipo) === 'Extra' ? normalizarPlantaoExtra(row.plantao_extra) : '',
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
  if (data.cadeiaSubstituicao !== undefined) row.cadeia_substituicao = data.cadeiaSubstituicao;
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
  const cadeiaInput: EloCadeiaInput[] = substituicao.cadeiaSubstituicao.map(elo => ({
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
    dataInicio: substituicao.dataInicio,
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
  if (aprovado?.tipo === 'Afastamento' || aprovado?.tipo === 'Substituição') {
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
