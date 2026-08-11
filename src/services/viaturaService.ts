import { supabase } from '../lib/supabase';
import type { Viatura } from '../types/viatura';

const TABLE = 'viaturas';

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

function rowToViatura(row: Record<string, unknown>): Viatura {
  const status = (row.status as Viatura['status']) || 'Operacional';
  return {
    id: row.id as string,
    prefixo: (row.prefixo as string) || '',
    placa: (row.placa as string) || '',
    renavam: (row.renavam as string) || '',
    tipo: (row.tipo as Viatura['tipo']) || 'CCI',
    tipoCCI: (row.tipo_cci as Viatura['tipoCCI']) || 'CCI-2',
    categoriaCAT: (row.categoria_cat as Viatura['categoriaCAT']) || 'CAT A',
    status,
    situacao: status,
    marca: (row.marca as string) || '',
    modelo: (row.modelo as string) || '',
    ano: (row.ano as string) || '',
    quilometragem: (row.quilometragem as string) || '',
    horasMotor: (row.horas_motor as string) || '',
    cartaoCombustivel: (row.cartao_combustivel as string) || '',
    capacidadeAgua: (row.capacidade_agua as string) || '',
    capacidadeLGE: (row.capacidade_lge as string) || '',
    moduloPQuimico: (row.modulo_p_quimico as string) || '',
    bombaModelo: (row.bomba_modelo as string) || '',
    bombaVazao: (row.bomba_vazao as string) || '',
    canhaoTetoModelo: (row.canhao_teto_modelo as string) || '',
    canhaoTetoAlcance: (row.canhao_teto_alcance as string) || '',
    canhaoTetoVazao: (row.canhao_teto_vazao as string) || '',
    canhaoParachoqueModelo: (row.canhao_parachoque_modelo as string) || '',
    canhaoParachoqueAlcance: (row.canhao_parachoque_alcance as string) || '',
    canhaoParachoqueVazao: (row.canhao_parachoque_vazao as string) || '',
    autoprotecaoQtd: (row.autoprotecao_qtd as string) || '',
    autoprotecaoLocal: (row.autoprotecao_local as string) || '',
    carreteisQtd: (row.carreteis_qtd as string) || '',
    proporcionalidade: (row.proporcionalidade as string) || '',
    radioSistema: (row.radio_sistema as Viatura['radioSistema']) || 'UHF',
    giroflexSirene: (row.giroflex_sirene as Viatura['giroflexSirene']) || 'Funcional',
    observacoes: (row.observacoes as string) || '',
    fotoUrl: (row.foto_url as string) || '',
    manualUrl: (row.manual_url as string) || '',
    createdBy: (row.created_by as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function viaturaToRow(data: Partial<Viatura>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.prefixo !== undefined) row.prefixo = data.prefixo;
  if (data.placa !== undefined) row.placa = data.placa;
  if (data.renavam !== undefined) row.renavam = data.renavam;
  if (data.tipo !== undefined) row.tipo = data.tipo;
  if (data.tipoCCI !== undefined) row.tipo_cci = data.tipoCCI;
  if (data.categoriaCAT !== undefined) row.categoria_cat = data.categoriaCAT;
  if (data.status !== undefined) row.status = data.status;
  if (data.marca !== undefined) row.marca = data.marca;
  if (data.modelo !== undefined) row.modelo = data.modelo;
  if (data.ano !== undefined) row.ano = data.ano;
  if (data.quilometragem !== undefined) row.quilometragem = data.quilometragem;
  if (data.horasMotor !== undefined) row.horas_motor = data.horasMotor;
  if (data.cartaoCombustivel !== undefined) row.cartao_combustivel = data.cartaoCombustivel;
  if (data.capacidadeAgua !== undefined) row.capacidade_agua = data.capacidadeAgua;
  if (data.capacidadeLGE !== undefined) row.capacidade_lge = data.capacidadeLGE;
  if (data.moduloPQuimico !== undefined) row.modulo_p_quimico = data.moduloPQuimico;
  if (data.bombaModelo !== undefined) row.bomba_modelo = data.bombaModelo;
  if (data.bombaVazao !== undefined) row.bomba_vazao = data.bombaVazao;
  if (data.canhaoTetoModelo !== undefined) row.canhao_teto_modelo = data.canhaoTetoModelo;
  if (data.canhaoTetoAlcance !== undefined) row.canhao_teto_alcance = data.canhaoTetoAlcance;
  if (data.canhaoTetoVazao !== undefined) row.canhao_teto_vazao = data.canhaoTetoVazao;
  if (data.canhaoParachoqueModelo !== undefined) row.canhao_parachoque_modelo = data.canhaoParachoqueModelo;
  if (data.canhaoParachoqueAlcance !== undefined) row.canhao_parachoque_alcance = data.canhaoParachoqueAlcance;
  if (data.canhaoParachoqueVazao !== undefined) row.canhao_parachoque_vazao = data.canhaoParachoqueVazao;
  if (data.autoprotecaoQtd !== undefined) row.autoprotecao_qtd = data.autoprotecaoQtd;
  if (data.autoprotecaoLocal !== undefined) row.autoprotecao_local = data.autoprotecaoLocal;
  if (data.carreteisQtd !== undefined) row.carreteis_qtd = data.carreteisQtd;
  if (data.proporcionalidade !== undefined) row.proporcionalidade = data.proporcionalidade;
  if (data.radioSistema !== undefined) row.radio_sistema = data.radioSistema;
  if (data.giroflexSirene !== undefined) row.giroflex_sirene = data.giroflexSirene;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;
  if (data.fotoUrl !== undefined) row.foto_url = data.fotoUrl;
  if (data.manualUrl !== undefined) row.manual_url = data.manualUrl;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export async function listarViaturas(params?: { tipo?: string }): Promise<Viatura[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (params?.tipo) query = query.eq('tipo', params.tipo);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToViatura);
}

export async function contarViaturas(): Promise<number> {
  const db = getDb();
  const { count, error } = await db.from(TABLE).select('*', { count: 'exact', head: true });
  if (error) handleSupabaseError(error);
  return count || 0;
}

export async function criarViatura(data: Omit<Viatura, 'id' | 'createdAt' | 'updatedAt'>): Promise<Viatura> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...viaturaToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToViatura(created);
}

export async function atualizarViatura(id: string, data: Partial<Viatura>): Promise<Viatura> {
  const db = getDb();
  const row = { ...viaturaToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToViatura(updated);
}

export async function excluirViatura(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
