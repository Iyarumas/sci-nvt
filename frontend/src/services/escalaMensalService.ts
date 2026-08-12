import { supabase } from '../lib/supabase';
import type { EscalaMensalConfig, EscalaMensalCompleta } from '../types/escalaMensal';
import { gerarEscalaMensal } from './escalaMensalGenerator';

const CONFIG_TABLE = 'escalas_mensais_config';
const GERADAS_TABLE = 'escalas_mensais_geradas';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function parseJSON(val: unknown): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

function rowToConfig(row: Record<string, unknown>): EscalaMensalConfig {
  return {
    id: row.id as string,
    equipe: (row.equipe as string) || '',
    mes: (row.mes as number) || 1,
    ano: (row.ano as number) || 2026,
    paridade: (row.paridade as 'par' | 'impar') || 'impar',
    pessoas: parseJSON(row.pessoas) || [],
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function configToRow(data: Partial<EscalaMensalConfig>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (data.equipe !== undefined) r.equipe = data.equipe;
  if (data.mes !== undefined) r.mes = data.mes;
  if (data.ano !== undefined) r.ano = data.ano;
  if (data.paridade !== undefined) r.paridade = data.paridade;
  if (data.pessoas !== undefined) r.pessoas = data.pessoas;
  return r;
}

function rowToCompleta(row: Record<string, unknown>, config: EscalaMensalConfig): EscalaMensalCompleta {
  return {
    config,
    paradas: parseJSON(row.paradas) || [],
    faxinaMensal: parseJSON(row.faxina_mensal) || [],
    responsabilidades: parseJSON(row.responsabilidades) || [],
  };
}

export async function listarConfigs(): Promise<EscalaMensalConfig[]> {
  const db = getDb();
  const { data, error } = await db.from(CONFIG_TABLE).select('*');
  if (error) throw error;
  return (data || []).map(rowToConfig);
}

export async function listarCompletas(): Promise<EscalaMensalCompleta[]> {
  const db = getDb();
  const { data: configs, error: err1 } = await db.from(CONFIG_TABLE).select('*');
  if (err1) throw err1;
  const { data: geradas, error: err2 } = await db.from(GERADAS_TABLE).select('*');
  if (err2) throw err2;
  const configMap = new Map((configs || []).map((c: any) => [c.id, rowToConfig(c)]));
  return (geradas || []).map((g: any) => {
    const config = configMap.get(g.config_id) || {} as EscalaMensalConfig;
    return rowToCompleta(g, config);
  });
}

export function novaConfigId(): string {
  return crypto.randomUUID();
}

export async function salvarConfig(config: EscalaMensalConfig): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.from(CONFIG_TABLE).select('id').eq('id', config.id).single();
  if (existing.data) {
    await db.from(CONFIG_TABLE).update({ ...configToRow(config), updated_at: now }).eq('id', config.id);
  } else {
    await db.from(CONFIG_TABLE).insert({ id: config.id, ...configToRow(config), created_at: now, updated_at: now });
  }
}

export async function excluirConfig(id: string): Promise<void> {
  const db = getDb();
  await db.from(GERADAS_TABLE).delete().eq('config_id', id);
  await db.from(CONFIG_TABLE).delete().eq('id', id);
}

export async function obterCompleta(configId: string): Promise<EscalaMensalCompleta | undefined> {
  const db = getDb();
  const { data: configData } = await db.from(CONFIG_TABLE).select('*').eq('id', configId).single();
  if (!configData) return undefined;
  const config = rowToConfig(configData);
  const { data: gerada } = await db.from(GERADAS_TABLE).select('*').eq('config_id', configId).single();
  if (!gerada) return undefined;
  return rowToCompleta(gerada, config);
}

export async function salvarCompleta(completa: EscalaMensalCompleta): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await salvarConfig(completa.config);
  const row = {
    config_id: completa.config.id,
    paradas: completa.paradas,
    faxina_mensal: completa.faxinaMensal,
    responsabilidades: completa.responsabilidades,
    created_at: now,
  };
  const existing = await db.from(GERADAS_TABLE).select('id').eq('config_id', completa.config.id).single();
  if (existing.data) {
    await db.from(GERADAS_TABLE).update(row).eq('config_id', completa.config.id);
  } else {
    await db.from(GERADAS_TABLE).insert(row);
  }
}

export function gerarNomesMes(): string[] {
  return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
}

export { gerarEscalaMensal };

export function clonarConfig(config: EscalaMensalConfig, novoMes: number, novoAno: number): EscalaMensalConfig {
  return {
    ...config,
    id: crypto.randomUUID(),
    mes: novoMes,
    ano: novoAno,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
