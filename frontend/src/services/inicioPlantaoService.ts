import { apiFetch } from '../lib/apiClient';
import type { DadosInicioPlantao, InicioPlantaoSalvo } from '../types/inicioPlantao';

/** Quando não há registro o servidor responde sem corpo; trata como "nenhum". */
async function ouNulo<T>(pedido: Promise<T | null | ''>): Promise<T | null> {
  const resposta = await pedido;
  return resposta && typeof resposta === 'object' ? resposta : null;
}

export function obterInicioPlantao(data: string, equipe: string): Promise<InicioPlantaoSalvo | null> {
  const params = new URLSearchParams({ data, equipe });
  return ouNulo(apiFetch<InicioPlantaoSalvo | null>(`/inicio-plantao?${params.toString()}`, { cache: 'no-store' }));
}

/** O último início de plantão antes da data, para sugerir o que costuma se repetir. */
export function obterInicioPlantaoAnterior(data: string): Promise<InicioPlantaoSalvo | null> {
  return ouNulo(apiFetch<InicioPlantaoSalvo | null>(`/inicio-plantao/anterior?${new URLSearchParams({ data }).toString()}`, { cache: 'no-store' }));
}

export function salvarInicioPlantao(input: {
  data: string;
  equipe: string;
  dados: DadosInicioPlantao;
  mensagem: string;
}): Promise<InicioPlantaoSalvo> {
  return apiFetch<InicioPlantaoSalvo>('/inicio-plantao', { method: 'PUT', body: JSON.stringify(input) });
}

export function obterMensagemPublica(token: string): Promise<{ data: string; equipe: string; mensagem: string }> {
  return apiFetch(`/inicio-plantao/mensagem/${encodeURIComponent(token)}`, { cache: 'no-store' });
}
