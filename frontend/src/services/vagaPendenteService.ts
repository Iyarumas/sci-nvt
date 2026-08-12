import { supabase } from '../lib/supabase';
import type { Bombeiro } from '../types/bombeiro';

const TABLE = 'vagas_pendentes';
const STORAGE_KEY = 'sescinc-vagas-pendentes';

export interface VagaPendente {
  id: string;
  equipe: string;
  cargo: string;
  dataInicio: string;
  dataFim: string;
  funcionarioAusenteId: string;
  funcionarioAusenteNome: string;
  motivo: 'ferias' | 'cascata' | 'outra_equipe';
  cadeiaFeriasId: string;
  preenchidoPorId: string;
  preenchidoPorNome: string;
  resolvido: boolean;
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

function rowToVaga(row: Record<string, unknown>): VagaPendente {
  return {
    id: row.id as string,
    equipe: (row.equipe as string) || '',
    cargo: (row.cargo as string) || '',
    dataInicio: (row.data_inicio as string) || '',
    dataFim: (row.data_fim as string) || '',
    funcionarioAusenteId: (row.funcionario_ausente_id as string) || '',
    funcionarioAusenteNome: (row.funcionario_ausente_nome as string) || '',
    motivo: (row.motivo as VagaPendente['motivo']) || 'ferias',
    cadeiaFeriasId: (row.cadeia_ferias_id as string) || '',
    preenchidoPorId: (row.preenchido_por_id as string) || '',
    preenchidoPorNome: (row.preenchido_por_nome as string) || '',
    resolvido: row.resolvido !== false,
    createdAt: (row.created_at as string) || '',
  };
}

export async function listarVagasPendentes(params?: {
  equipe?: string;
  resolvido?: boolean;
}): Promise<VagaPendente[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.resolvido !== undefined) query = query.eq('resolvido', params.resolvido);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToVaga);
}

export async function criarVagaPendente(
  data: Omit<VagaPendente, 'id' | 'createdAt'>,
): Promise<VagaPendente> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    equipe: data.equipe,
    cargo: data.cargo,
    data_inicio: data.dataInicio,
    data_fim: data.dataFim,
    funcionario_ausente_id: data.funcionarioAusenteId,
    funcionario_ausente_nome: data.funcionarioAusenteNome,
    motivo: data.motivo,
    cadeia_ferias_id: data.cadeiaFeriasId,
    preenchido_por_id: data.preenchidoPorId || '',
    preenchido_por_nome: data.preenchidoPorNome || '',
    resolvido: data.resolvido !== false,
    created_at: now,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToVaga(created);
}

export async function resolverVaga(
  id: string,
  preenchidoPorId: string,
  preenchidoPorNome: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from(TABLE)
    .update({
      resolvido: true,
      preenchido_por_id: preenchidoPorId,
      preenchido_por_nome: preenchidoPorNome,
    })
    .eq('id', id);
  if (error) handleSupabaseError(error);
}

/**
 * Após processar a cascata de substituições, verifica se há vagas pendentes
 * e tenta preenchê-las automaticamente com Feristas disponíveis.
 */
export async function tentarPreencherVagasAuto(
  feriasId: string,
  bombeiros: Bombeiro[],
): Promise<VagaPendente[]> {
  const vagas = await listarVagasPendentes({ resolvido: false });
  const criadas: VagaPendente[] = [];

  for (const vaga of vagas) {
    if (vaga.resolvido) continue;

    // Se a vaga é para BA-2, tentar preencher com Ferista
    if (vaga.cargo === 'BA-2') {
      const ferista = bombeiros.find(b =>
        b.equipe === 'Ferista' && !b.dataDesligamento
      );
      if (ferista) {
        await resolverVaga(vaga.id, ferista.id, ferista.nomeCompleto);
        criadas.push({ ...vaga, preenchidoPorId: ferista.id, preenchidoPorNome: ferista.nomeCompleto, resolvido: true });
      }
    }
  }

  return criadas;
}
