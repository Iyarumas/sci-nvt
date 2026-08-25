import { supabase } from '../lib/supabase';

const TABLE = 'lro_drafts';

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

export type LRODraftStatus = 'rascunho' | 'aguardando' | 'assinado' | 'cancelado' | 'finalizado' | 'arquivado';
const STATUS_CONCLUIDO = new Set<LRODraftStatus>(['assinado', 'finalizado', 'arquivado']);

export interface LRODraft {
  id: string;
  equipe: string;
  data_plantao: string;
  status: LRODraftStatus;
  autentique_doc_id?: string;
  dados: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

function usuarioAuditavel(value: unknown): string {
  return String(value || '').trim();
}

function dadosComAuditoria(
  dados: Record<string, unknown>,
  usuario: string,
  now: string,
  draftAtual?: LRODraft | null,
  registrarEdicaoAposConclusao = false,
): Record<string, unknown> {
  const dadosAtuais = draftAtual?.dados || {};
  const createdBy = usuarioAuditavel(draftAtual?.dados?._createdBy)
    || usuarioAuditavel(draftAtual?.created_by)
    || usuarioAuditavel(dados._createdBy)
    || usuarioAuditavel(usuario);

  const auditoria: Record<string, unknown> = {
    ...dados,
    _createdBy: createdBy,
    _completedBy: usuarioAuditavel(dados._completedBy) || usuarioAuditavel(dadosAtuais._completedBy),
    _completedAt: usuarioAuditavel(dados._completedAt) || usuarioAuditavel(dadosAtuais._completedAt),
    _lastPostCompletionEditBy: usuarioAuditavel(dados._lastPostCompletionEditBy) || usuarioAuditavel(dadosAtuais._lastPostCompletionEditBy),
    _lastPostCompletionEditAt: usuarioAuditavel(dados._lastPostCompletionEditAt) || usuarioAuditavel(dadosAtuais._lastPostCompletionEditAt),
  };

  if (registrarEdicaoAposConclusao) {
    auditoria._lastPostCompletionEditBy = usuarioAuditavel(usuario) || createdBy;
    auditoria._lastPostCompletionEditAt = now;
  }

  return auditoria;
}

function rowToDraft(row: Record<string, unknown>): LRODraft {
  return {
    id: row.id as string,
    equipe: (row.equipe as string) || '',
    data_plantao: (row.data_plantao as string) || '',
    status: (row.status as LRODraftStatus) || 'rascunho',
    autentique_doc_id: row.autentique_doc_id as string | undefined,
    dados: (row.dados as Record<string, unknown>) || {},
    created_by: (row.created_by as string) || '',
    created_at: (row.created_at as string) || '',
    updated_at: (row.updated_at as string) || '',
    expires_at: (row.expires_at as string) || '',
  };
}

export async function listarDrafts(createdBy: string): Promise<LRODraft[]> {
  const db = getDb();
  let query = db.from(TABLE).select('*');
  if (createdBy) query = query.eq('created_by', createdBy);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToDraft);
}

export async function obterDraft(id: string): Promise<LRODraft | null> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return data ? rowToDraft(data) : null;
}

export async function salvarDraft(
  dados: Record<string, unknown>,
  equipe: string,
  data_plantao: string,
  createdBy: string,
  draftId?: string,
): Promise<LRODraft> {
  const db = getDb();
  const now = new Date().toISOString();

  if (draftId) {
    const draftAtual = await obterDraft(draftId);
    const registrarEdicaoAposConclusao = draftAtual ? STATUS_CONCLUIDO.has(draftAtual.status) : false;
    const row = {
      equipe,
      data_plantao,
      dados: dadosComAuditoria(dados, createdBy, now, draftAtual, registrarEdicaoAposConclusao),
      updated_at: now,
    };
    const { data, error } = await db.from(TABLE).update(row).eq('id', draftId).select().single();
    if (error) handleSupabaseError(error);
    return rowToDraft(data);
  }

  const row = {
    equipe,
    data_plantao,
    dados: dadosComAuditoria(dados, createdBy, now),
    created_by: createdBy,
    updated_at: now,
  };
  const { data, error } = await db.from(TABLE).insert({ ...row, created_at: now, status: 'rascunho' }).select().single();
  if (error) handleSupabaseError(error);
  return rowToDraft(data);
}

export async function atualizarStatus(
  id: string,
  status: LRODraftStatus,
  autentiqueDocId?: string,
  updatedBy?: string,
): Promise<LRODraft> {
  const db = getDb();
  const now = new Date().toISOString();
  const r: Record<string, unknown> = { status, updated_at: now };
  if (autentiqueDocId) r.autentique_doc_id = autentiqueDocId;
  if (updatedBy && STATUS_CONCLUIDO.has(status)) {
    const draftAtual = await obterDraft(id);
    const dadosAuditados = dadosComAuditoria(draftAtual?.dados || {}, updatedBy, now, draftAtual);
    dadosAuditados._completedBy = usuarioAuditavel(dadosAuditados._completedBy) || usuarioAuditavel(updatedBy) || dadosAuditados._createdBy;
    dadosAuditados._completedAt = usuarioAuditavel(dadosAuditados._completedAt) || now;
    r.dados = dadosAuditados;
  }
  const { data, error } = await db.from(TABLE).update(r).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToDraft(data);
}

export async function excluirDraft(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
}
