import type { Bombeiro } from '../types/bombeiro';
import { supabase } from '../lib/supabase';

const TABLE = 'bombeiros';
const PUBLIC_COLUMNS = 'id, matricula, nome_completo, nome_guerra, cargo, equipe, turno, foto, cnh_categoria, cnh_validade, credencial_validade, tipo_sanguineo, data_desligamento, created_at, updated_at';
const AUTORIZACAO_REGISTROS_DIARIOS_COLUMNS = 'id, matricula, nome_completo, nome_guerra, cargo, equipe, turno, foto, data_desligamento, autorizado_registros_diarios, autorizacao_registros_diarios_equipe, autorizacao_registros_diarios_status, autorizacao_registros_diarios_solicitado_por, autorizacao_registros_diarios_solicitado_em, autorizacao_registros_diarios_decidido_por, autorizacao_registros_diarios_decidido_em, created_at, updated_at';

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

function rowToBombeiro(row: Record<string, unknown>): Bombeiro {
  const nomeCompleto = (row.nome_completo as string) || (row.nome as string) || '';
  return {
    id: row.id as string,
    matricula: row.matricula as string,
    nome: nomeCompleto,
    nomeCompleto,
    nomeGuerra: row.nome_guerra as string,
    email: row.email as string,
    dataNascimento: row.data_nascimento as string,
    idade: row.idade as number,
    dataAdmissao: row.data_admissao as string,
    cargo: row.cargo as Bombeiro['cargo'],
    equipe: row.equipe as Bombeiro['equipe'],
    turno: row.turno as Bombeiro['turno'],
    tipoSanguineo: row.tipo_sanguineo as string,
    cpf: row.cpf as string,
    rg: row.rg as string,
    cnhNumero: row.cnh_numero as string,
    cnhCategoria: row.cnh_categoria as Bombeiro['cnhCategoria'],
    cnhValidade: row.cnh_validade as string,
    credencialValidade: (row.credencial_validade as string) || '',
    foto: row.foto as string,
    dataDesligamento: row.data_desligamento as string,
    endereco: row.endereco as string,
    numeroEndereco: row.numero_endereco as string,
    complemento: row.complemento as string,
    bairro: (row.bairro as string) || '',
    cep: row.cep as string,
    uf: row.uf as string,
    municipio: row.municipio as string,
    celular: row.celular as string,
    sexo: row.sexo as Bombeiro['sexo'],
    cursoChefeEquipe: row.curso_chefe_equipe as boolean,
    cursoMotoristaCCI: row.curso_motorista_cci as boolean,
    cursoCVE: row.curso_cve as boolean,
    autorizadoRegistrosDiarios: row.autorizado_registros_diarios as boolean || false,
    autorizacaoRegistrosDiariosEquipe: (row.autorizacao_registros_diarios_equipe as Bombeiro['autorizacaoRegistrosDiariosEquipe']) || '',
    autorizacaoRegistrosDiariosStatus: (row.autorizacao_registros_diarios_status as Bombeiro['autorizacaoRegistrosDiariosStatus']) || 'nenhuma',
    autorizacaoRegistrosDiariosSolicitadoPor: (row.autorizacao_registros_diarios_solicitado_por as string) || '',
    autorizacaoRegistrosDiariosSolicitadoEm: (row.autorizacao_registros_diarios_solicitado_em as string) || '',
    autorizacaoRegistrosDiariosDecididoPor: (row.autorizacao_registros_diarios_decidido_por as string) || '',
    autorizacaoRegistrosDiariosDecididoEm: (row.autorizacao_registros_diarios_decidido_em as string) || '',
    cveValidade: (row.cve_validade as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToBombeiroPublico(row: Record<string, unknown>): Bombeiro {
  return rowToBombeiro({
    email: '',
    data_nascimento: '',
    idade: 0,
    data_admissao: '',
    tipo_sanguineo: '',
    cpf: '',
    rg: '',
    cnh_numero: '',
    cnh_categoria: '',
    cnh_validade: '',
    credencial_validade: '',
    endereco: '',
    numero_endereco: '',
    complemento: '',
    bairro: '',
    cep: '',
    uf: '',
    municipio: '',
    celular: '',
    sexo: 'M',
    curso_chefe_equipe: false,
    curso_motorista_cci: false,
    curso_cve: false,
    autorizado_registros_diarios: false,
    autorizacao_registros_diarios_equipe: '',
    autorizacao_registros_diarios_status: 'nenhuma',
    autorizacao_registros_diarios_solicitado_por: '',
    autorizacao_registros_diarios_solicitado_em: '',
    autorizacao_registros_diarios_decidido_por: '',
    autorizacao_registros_diarios_decidido_em: '',
    cve_validade: '',
    ...row,
  });
}

function bombeiroToRow(data: Omit<Bombeiro, 'id' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  return {
    matricula: data.matricula,
    nome_completo: data.nomeCompleto,
    nome_guerra: data.nomeGuerra,
    email: data.email,
    data_nascimento: data.dataNascimento,
    idade: data.idade,
    data_admissao: data.dataAdmissao,
    cargo: data.cargo,
    equipe: data.equipe,
    turno: data.turno,
    tipo_sanguineo: data.tipoSanguineo,
    cpf: data.cpf,
    rg: data.rg,
    cnh_numero: data.cnhNumero,
    cnh_categoria: data.cnhCategoria,
    cnh_validade: data.cnhValidade,
    credencial_validade: data.credencialValidade,
    foto: data.foto,
    data_desligamento: data.dataDesligamento,
    endereco: data.endereco,
    numero_endereco: data.numeroEndereco,
    complemento: data.complemento,
    bairro: data.bairro,
    cep: data.cep,
    uf: data.uf,
    municipio: data.municipio,
    celular: data.celular,
    sexo: data.sexo,
    curso_chefe_equipe: data.cursoChefeEquipe,
    curso_motorista_cci: data.cursoMotoristaCCI,
    curso_cve: data.cursoCVE,
    autorizado_registros_diarios: data.autorizadoRegistrosDiarios,
    autorizacao_registros_diarios_equipe: data.autorizacaoRegistrosDiariosEquipe,
    autorizacao_registros_diarios_status: data.autorizacaoRegistrosDiariosStatus,
    autorizacao_registros_diarios_solicitado_por: data.autorizacaoRegistrosDiariosSolicitadoPor,
    autorizacao_registros_diarios_solicitado_em: data.autorizacaoRegistrosDiariosSolicitadoEm,
    autorizacao_registros_diarios_decidido_por: data.autorizacaoRegistrosDiariosDecididoPor,
    autorizacao_registros_diarios_decidido_em: data.autorizacaoRegistrosDiariosDecididoEm,
    cve_validade: data.cveValidade || '',
  };
}

export async function listarBombeiros(params?: {
  equipe?: string;
  cargo?: string;
  ids?: string[];
}): Promise<Bombeiro[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.cargo) query = query.eq('cargo', params.cargo);
  if (params?.ids && params.ids.length > 0) query = query.in('id', params.ids);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiro);
}

export async function listarBombeirosPublico(params?: {
  equipe?: string;
  cargo?: string;
}): Promise<Bombeiro[]> {
  const db = getDb();
  let query = db.from(TABLE).select(PUBLIC_COLUMNS).order('created_at', { ascending: false });
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.cargo) query = query.eq('cargo', params.cargo);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiroPublico);
}

export async function listarBombeirosParaAutorizacaoRegistrosDiarios(): Promise<Bombeiro[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(AUTORIZACAO_REGISTROS_DIARIOS_COLUMNS)
    .order('nome_guerra', { ascending: true });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiroPublico);
}

export async function buscarBombeiro(termo: string): Promise<Bombeiro[]> {
  const t = termo.toLowerCase();
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .or(`nome_completo.ilike.%${t}%,nome_guerra.ilike.%${t}%,cpf.ilike.%${t}%,matricula.ilike.%${t}%,equipe.ilike.%${t}%`);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiro);
}

export async function buscarBombeiroPublico(termo: string): Promise<Bombeiro[]> {
  const t = termo.toLowerCase();
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select(PUBLIC_COLUMNS)
    .or(`nome_completo.ilike.%${t}%,nome_guerra.ilike.%${t}%,matricula.ilike.%${t}%,equipe.ilike.%${t}%`);
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiroPublico);
}

export async function obterBombeiro(id: string): Promise<Bombeiro | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).single();
  if (error) handleSupabaseError(error);
  return data ? rowToBombeiro(data) : null;
}

export interface BombeiroResumo {
  id: string;
  nomeGuerra: string;
  equipe: Bombeiro['equipe'];
}

export async function listarBombeirosResumido(): Promise<BombeiroResumo[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('id, nome_guerra, equipe')
    .or('data_desligamento.is.null,data_desligamento.eq.');
  if (error) handleSupabaseError(error);
  return (data || []).map((r: any) => ({
    id: r.id as string,
    nomeGuerra: (r.nome_guerra as string) || '',
    equipe: ((r.equipe as string) || 'Embaixador') as Bombeiro['equipe'],
  }));
}

export async function listarAtivos(params?: {
  equipe?: string;
  cargo?: string;
}): Promise<Bombeiro[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*').or('data_desligamento.is.null,data_desligamento.eq.');
  if (params?.equipe) query = query.eq('equipe', params.equipe);
  if (params?.cargo) query = query.eq('cargo', params.cargo);
  query = query.order('nome_completo');
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToBombeiro);
}

export async function criarBombeiro(data: Omit<Bombeiro, 'id' | 'createdAt' | 'updatedAt'>): Promise<Bombeiro> {
  const db = getDb();
  const row = bombeiroToRow(data);
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToBombeiro(created);
}

export async function atualizarBombeiro(id: string, data: Partial<Bombeiro>): Promise<Bombeiro | null> {
  const db = getDb();
  const row: Record<string, unknown> = {};
  if (data.matricula !== undefined) row.matricula = data.matricula;
  if (data.nomeCompleto !== undefined) row.nome_completo = data.nomeCompleto;
  if (data.nomeGuerra !== undefined) row.nome_guerra = data.nomeGuerra;
  if (data.email !== undefined) row.email = data.email;
  if (data.dataNascimento !== undefined) row.data_nascimento = data.dataNascimento;
  if (data.idade !== undefined) row.idade = data.idade;
  if (data.dataAdmissao !== undefined) row.data_admissao = data.dataAdmissao;
  if (data.cargo !== undefined) row.cargo = data.cargo;
  if (data.equipe !== undefined) row.equipe = data.equipe;
  if (data.turno !== undefined) row.turno = data.turno;
  if (data.tipoSanguineo !== undefined) row.tipo_sanguineo = data.tipoSanguineo;
  if (data.cpf !== undefined) row.cpf = data.cpf;
  if (data.rg !== undefined) row.rg = data.rg;
  if (data.cnhNumero !== undefined) row.cnh_numero = data.cnhNumero;
  if (data.cnhCategoria !== undefined) row.cnh_categoria = data.cnhCategoria;
  if (data.cnhValidade !== undefined) row.cnh_validade = data.cnhValidade;
  if (data.foto !== undefined) row.foto = data.foto;
  if (data.dataDesligamento !== undefined) row.data_desligamento = data.dataDesligamento;
  if (data.endereco !== undefined) row.endereco = data.endereco;
  if (data.numeroEndereco !== undefined) row.numero_endereco = data.numeroEndereco;
  if (data.complemento !== undefined) row.complemento = data.complemento;
  if (data.bairro !== undefined) row.bairro = data.bairro;
  if (data.cep !== undefined) row.cep = data.cep;
  if (data.uf !== undefined) row.uf = data.uf;
  if (data.municipio !== undefined) row.municipio = data.municipio;
  if (data.celular !== undefined) row.celular = data.celular;
  if (data.sexo !== undefined) row.sexo = data.sexo;
  if (data.cursoChefeEquipe !== undefined) row.curso_chefe_equipe = data.cursoChefeEquipe;
  if (data.cursoMotoristaCCI !== undefined) row.curso_motorista_cci = data.cursoMotoristaCCI;
  if (data.cursoCVE !== undefined) row.curso_cve = data.cursoCVE;
  if (data.autorizadoRegistrosDiarios !== undefined) row.autorizado_registros_diarios = data.autorizadoRegistrosDiarios;
  if (data.autorizacaoRegistrosDiariosEquipe !== undefined) row.autorizacao_registros_diarios_equipe = data.autorizacaoRegistrosDiariosEquipe;
  if (data.autorizacaoRegistrosDiariosStatus !== undefined) row.autorizacao_registros_diarios_status = data.autorizacaoRegistrosDiariosStatus;
  if (data.autorizacaoRegistrosDiariosSolicitadoPor !== undefined) row.autorizacao_registros_diarios_solicitado_por = data.autorizacaoRegistrosDiariosSolicitadoPor;
  if (data.autorizacaoRegistrosDiariosSolicitadoEm !== undefined) row.autorizacao_registros_diarios_solicitado_em = data.autorizacaoRegistrosDiariosSolicitadoEm;
  if (data.autorizacaoRegistrosDiariosDecididoPor !== undefined) row.autorizacao_registros_diarios_decidido_por = data.autorizacaoRegistrosDiariosDecididoPor;
  if (data.autorizacaoRegistrosDiariosDecididoEm !== undefined) row.autorizacao_registros_diarios_decidido_em = data.autorizacaoRegistrosDiariosDecididoEm;
  if (data.cveValidade !== undefined) row.cve_validade = data.cveValidade;
  if (data.credencialValidade !== undefined) row.credencial_validade = data.credencialValidade;
  row.updated_at = new Date().toISOString();

  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToBombeiro(updated) : null;
}

export async function aprovarAutorizacaoRegistrosDiarios(id: string, aprovadoPor: string): Promise<Bombeiro | null> {
  return atualizarBombeiro(id, {
    autorizadoRegistrosDiarios: true,
    autorizacaoRegistrosDiariosStatus: 'aprovado',
    autorizacaoRegistrosDiariosDecididoPor: aprovadoPor,
    autorizacaoRegistrosDiariosDecididoEm: new Date().toISOString(),
  });
}

export async function rejeitarAutorizacaoRegistrosDiarios(id: string, rejeitadoPor: string): Promise<Bombeiro | null> {
  return atualizarBombeiro(id, {
    autorizadoRegistrosDiarios: false,
    autorizacaoRegistrosDiariosStatus: 'rejeitado',
    autorizacaoRegistrosDiariosDecididoPor: rejeitadoPor,
    autorizacaoRegistrosDiariosDecididoEm: new Date().toISOString(),
  });
}

export async function excluirBombeiro(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
