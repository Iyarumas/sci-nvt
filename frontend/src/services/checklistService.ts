import { supabase } from '../lib/supabase';
import type { Checklist, ChecklistColumn, ChecklistPayload, ChecklistQuinzena, ChecklistRow, ChecklistTipo } from '../types/checklist';

const TABLE = 'checklists';

type ChecklistJson = {
  meta?: {
    data?: string;
    equipe?: string;
    responsavel?: string;
    status?: Checklist['status'];
    mes?: number;
    ano?: number;
    quinzena?: ChecklistQuinzena;
  };
  colunas?: ChecklistColumn[];
  linhas?: ChecklistRow[];
};

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

function asChecklistJson(value: unknown): ChecklistJson {
  if (value && typeof value === 'object') return value as ChecklistJson;
  return {};
}

function normalizarPayload(raw: ChecklistJson): ChecklistPayload {
  const meta = raw.meta || {};
  return {
    mes: Number(meta.mes) || new Date().getMonth() + 1,
    ano: Number(meta.ano) || new Date().getFullYear(),
    quinzena: meta.quinzena === '2' ? '2' : '1',
    colunas: Array.isArray(raw.colunas) ? raw.colunas : [],
    linhas: Array.isArray(raw.linhas) ? raw.linhas : [],
  };
}

function rowToChecklist(row: Record<string, unknown>): Checklist {
  const raw = asChecklistJson(row.itens);
  const meta = raw.meta || {};
  const payload = normalizarPayload(raw);
  return {
    id: String(row.id || ''),
    titulo: String(row.titulo || ''),
    descricao: String(row.descricao || ''),
    tipo: row.tipo === 'personalizado' ? 'personalizado' : 'quinzenal',
    data: String(meta.data || ''),
    equipe: String(meta.equipe || ''),
    responsavel: String(meta.responsavel || ''),
    status: meta.status === 'concluido' ? 'concluido' : 'pendente',
    payload,
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function checklistToRow(data: Partial<Checklist>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const tipo = data.tipo || 'quinzenal';

  if (data.titulo !== undefined) row.titulo = data.titulo;
  if (data.descricao !== undefined) row.descricao = data.descricao;
  if (data.tipo !== undefined) row.tipo = tipo satisfies ChecklistTipo;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;

  if (data.payload) {
    row.itens = {
      meta: {
        data: data.data || '',
        equipe: data.equipe || '',
        responsavel: data.responsavel || '',
        status: data.status || 'pendente',
        mes: data.payload.mes,
        ano: data.payload.ano,
        quinzena: data.payload.quinzena,
      },
      colunas: data.payload.colunas,
      linhas: data.payload.linhas,
    };
  }

  return row;
}

export async function listarChecklists(): Promise<Checklist[]> {
  const db = getDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToChecklist);
}

export async function criarChecklist(data: Omit<Checklist, 'id' | 'createdAt' | 'updatedAt'>): Promise<Checklist> {
  const db = getDb();
  const now = new Date().toISOString();
  const row = { ...checklistToRow(data), created_at: now, updated_at: now };
  const { data: created, error } = await db.from(TABLE).insert(row).select().single();
  if (error) handleSupabaseError(error);
  return rowToChecklist(created);
}

export async function atualizarChecklist(id: string, data: Partial<Checklist>): Promise<Checklist> {
  const db = getDb();
  const row = { ...checklistToRow(data), updated_at: new Date().toISOString() };
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return rowToChecklist(updated);
}

export async function excluirChecklist(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
