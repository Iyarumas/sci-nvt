import { apiFetch } from '../lib/apiClient';
import { supabase } from '../lib/supabase';

const TABLE = 'convites';
const CONVITES_KEY = 'sescinc-convites';

export interface Convite {
  codigo: string;
  usado: boolean;
  createdAt: string;
  expiresAt: string;
  usadoEm?: string;
  registradoPor?: string;
}

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
}

function fallbackGet(): Record<string, Convite> {
  try {
    return JSON.parse(localStorage.getItem(CONVITES_KEY) || '{}');
  } catch {
    return {};
  }
}

function fallbackSave(convites: Record<string, Convite>) {
  localStorage.setItem(CONVITES_KEY, JSON.stringify(convites));
}

export async function criarConvite(createdBy?: string): Promise<Convite> {
  let codigo = gerarCodigo();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const convite: Convite = { codigo, usado: false, createdAt: now.toISOString(), expiresAt };

  try {
    const db = getDb();
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await db.from(TABLE).insert({
        codigo,
        usado: false,
        created_by: createdBy || null,
        expires_at: expiresAt,
      });
      if (!error) break;
      if (error.code === '23505') {
        attempts++;
        codigo = gerarCodigo();
        convite.codigo = codigo;
      } else {
        throw error;
      }
    }
  } catch {
    const convites = fallbackGet();
    let codigo = gerarCodigo();
    while (convites[codigo]) codigo = gerarCodigo();
    convite.codigo = codigo;
    convites[codigo] = convite;
    fallbackSave(convites);
  }

  return convite;
}

/** Validacao publica (sem login): o servidor so informa se o codigo pode ser usado. */
export async function validarConvite(codigo: string): Promise<Convite | null> {
  try {
    const result = await apiFetch<{ valido: boolean; expiresAt: string | null }>(
      `/auth/convite/${encodeURIComponent(codigo)}`,
      { cache: 'no-store' },
    );
    if (!result.valido) return null;
    return {
      codigo,
      usado: false,
      createdAt: '',
      expiresAt: result.expiresAt || '',
    };
  } catch {
    return null;
  }
}

export async function listarConvites(): Promise<Convite[]> {
  try {
    const db = getDb();
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      codigo: r.codigo,
      usado: r.usado,
      createdAt: r.created_at,
      expiresAt: r.expires_at || new Date(new Date(r.created_at).getTime() + 2 * 60 * 60 * 1000).toISOString(),
      usadoEm: r.usado_em,
      registradoPor: r.registrado_por,
    }));
  } catch {
    return Object.values(fallbackGet()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}
