import { supabase } from '../lib/supabase';
import { criarBonaDadosVazios } from '../types/ocorrencia';
import type { BonaBombeiro, BonaDados, Ocorrencia } from '../types/ocorrencia';

const TABLE = 'ocorrencias_operacionais';

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

function parseJSON(val: unknown): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

function normalizarFotos(val: unknown): string[] {
  const parsed = parseJSON(val);
  if (Array.isArray(parsed)) {
    return parsed.filter((foto): foto is string => typeof foto === 'string' && !!foto.trim());
  }
  if (typeof parsed === 'string' && parsed.trim()) {
    return [parsed];
  }
  return [];
}

function linhasBombeirosFromText(raw: unknown): BonaBombeiro[] {
  return String(raw || '')
    .split(/\r?\n|;|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [nome, ...funcao] = item.split(/\s+-\s+|\s+–\s+|\s+\|\s+/);
      return { nome: nome.trim(), funcao: funcao.join(' - ').trim() };
    })
    .filter(item => item.nome || item.funcao);
}

function normalizarBombeiros(value: unknown): BonaBombeiro[] {
  const parsed = parseJSON(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        nome: String(row.nome || '').trim(),
        funcao: String(row.funcao || '').trim(),
      };
    })
    .filter((item): item is BonaBombeiro => !!item && (!!item.nome || !!item.funcao));
}

function normalizarBonaDados(value: unknown, fallback?: Partial<Ocorrencia>): BonaDados {
  const parsed = parseJSON(value);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Partial<BonaDados>
    : {};
  const dados = criarBonaDadosVazios({
    ...source,
    bombeiros: normalizarBombeiros(source.bombeiros),
  });

  const fallbackBombeiros = linhasBombeirosFromText(fallback?.envolvidos);
  return criarBonaDadosVazios({
    ...dados,
    areaEvento: dados.areaEvento || fallback?.local || '',
    tipoOcorrencia: dados.tipoOcorrencia || fallback?.titulo || fallback?.categoria || '',
    bombeiros: dados.bombeiros.length > 0 ? dados.bombeiros : fallbackBombeiros,
    acionamento: dados.acionamento || fallback?.hora || '',
    descricaoOcorrencia: dados.descricaoOcorrencia || fallback?.descricao || '',
    descricaoAtuacaoEquipe: dados.descricaoAtuacaoEquipe || fallback?.acoesTomadas || '',
  });
}

function bombeirosParaTexto(bombeiros: BonaBombeiro[]): string {
  return bombeiros
    .filter(item => item.nome || item.funcao)
    .map(item => item.funcao ? `${item.nome} - ${item.funcao}` : item.nome)
    .join('\n');
}

function rowToOcorrencia(row: Record<string, unknown>): Ocorrencia {
  const numero = (row.numero as string) || '';
  const data = (row.data as string) || '';
  const categoria = (row.categoria as Ocorrencia['categoria']) || 'Outros';
  const tipoDocumento = row.tipo_documento === 'RAE' ? 'REA' : ((row.tipo_documento as Ocorrencia['tipoDocumento']) || 'BONA');
  const base = {
    id: row.id as string,
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    updatedBy: (row.updated_by as string) || '',
    tipoDocumento,
    numero,
    numeroOcorrencia: numero,
    data,
    dataOcorrencia: data,
    hora: (row.hora as string) || '',
    equipe: (row.equipe as string) || '',
    turno: (row.turno as string) || '',
    categoria,
    categoriaOcorrencia: categoria,
    titulo: (row.titulo as string) || '',
    descricao: (row.descricao as string) || '',
    local: (row.local as string) || '',
    envolvidos: (row.envolvidos as string) || '',
    acoesTomadas: (row.acoes_tomadas as string) || '',
    status: (row.status as Ocorrencia['status']) || 'Aberta',
    fotos: normalizarFotos(row.fotos),
  };
  return {
    ...base,
    bonaDados: normalizarBonaDados(row.bona_dados, base),
  };
}

function bonaDadosToRow(data: Partial<Ocorrencia>): Partial<Ocorrencia> {
  const bonaDados = normalizarBonaDados(data.bonaDados, data);
  const tipoOcorrencia = bonaDados.tipoOcorrencia || data.titulo || data.categoria || '';
  return {
    ...data,
    local: bonaDados.areaEvento || data.local || '',
    envolvidos: bombeirosParaTexto(bonaDados.bombeiros) || data.envolvidos || '',
    acoesTomadas: bonaDados.descricaoAtuacaoEquipe || data.acoesTomadas || '',
    descricao: bonaDados.descricaoOcorrencia || data.descricao || '',
    titulo: tipoOcorrencia || data.titulo || '',
    hora: data.hora || bonaDados.acionamento || '',
    bonaDados,
  };
}

export async function listarOcorrencias(params?: {
  status?: string;
  dataGte?: string;
  dataLte?: string;
  equipe?: string;
  categoria?: string;
  numeroPrefixo?: string;
}): Promise<Ocorrencia[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (params?.status) query = query.eq('status', params.status);
  if (params?.dataGte) query = query.gte('data', params.dataGte);
  if (params?.dataLte) query = query.lte('data', params.dataLte);
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.categoria) query = query.eq('categoria', params.categoria);
  if (params?.numeroPrefixo) query = query.like('numero', params.numeroPrefixo + '%');
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToOcorrencia);
}

export async function criarOcorrencia(data: Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>): Promise<Ocorrencia> {
  const db = getDb();
  const now = new Date().toISOString();
  const normalized = data.tipoDocumento === 'BONA' ? bonaDadosToRow(data) : data;
  const row = {
    created_by: data.createdBy, created_at: now, updated_at: now,
    tipo_documento: normalized.tipoDocumento, numero: normalized.numero,
    data: normalized.data, hora: normalized.hora, equipe: normalized.equipe, turno: normalized.turno,
    categoria: normalized.categoria, titulo: normalized.titulo, descricao: normalized.descricao,
    local: normalized.local, envolvidos: normalized.envolvidos, acoes_tomadas: normalized.acoesTomadas,
    status: normalized.status, fotos: normalizarFotos(normalized.fotos),
    bona_dados: normalized.bonaDados ? normalizarBonaDados(normalized.bonaDados, normalized) : undefined,
  };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToOcorrencia(created);
}

export async function atualizarOcorrencia(id: string, data: Partial<Ocorrencia>): Promise<Ocorrencia | null> {
  const db = getDb();
  const normalized = data.tipoDocumento === 'BONA' || data.bonaDados ? bonaDadosToRow(data) : data;
  const r: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (normalized.tipoDocumento !== undefined) r.tipo_documento = normalized.tipoDocumento;
  if (normalized.numero !== undefined) r.numero = normalized.numero;
  if (normalized.data !== undefined) r.data = normalized.data;
  if (normalized.hora !== undefined) r.hora = normalized.hora;
  if (normalized.equipe !== undefined) r.equipe = normalized.equipe;
  if (normalized.turno !== undefined) r.turno = normalized.turno;
  if (normalized.categoria !== undefined) r.categoria = normalized.categoria;
  if (normalized.titulo !== undefined) r.titulo = normalized.titulo;
  if (normalized.descricao !== undefined) r.descricao = normalized.descricao;
  if (normalized.local !== undefined) r.local = normalized.local;
  if (normalized.envolvidos !== undefined) r.envolvidos = normalized.envolvidos;
  if (normalized.acoesTomadas !== undefined) r.acoes_tomadas = normalized.acoesTomadas;
  if (normalized.status !== undefined) r.status = normalized.status;
  if (normalized.fotos !== undefined) r.fotos = normalizarFotos(normalized.fotos);
  if (normalized.bonaDados !== undefined) r.bona_dados = normalizarBonaDados(normalized.bonaDados, normalized);
  if (normalized.updatedBy !== undefined) r.updated_by = normalized.updatedBy;
  const { data: updated, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToOcorrencia(updated) : null;
}

export async function contarOcorrenciasAbertas(): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Fechada');
  if (error) handleSupabaseError(error);
  return count || 0;
}

export async function excluirOcorrencia(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
