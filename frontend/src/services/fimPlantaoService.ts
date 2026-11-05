import { apiFetch } from '../lib/apiClient';
import type { DadosFimPlantao, FimPlantaoSalvo } from '../types/fimPlantao';

/** Quando não há registro o servidor responde sem corpo; trata como "nenhum". */
async function ouNulo<T>(pedido: Promise<T | null | ''>): Promise<T | null> {
  const resposta = await pedido;
  return resposta && typeof resposta === 'object' ? resposta : null;
}

export function obterFimPlantao(data: string, equipe: string): Promise<FimPlantaoSalvo | null> {
  return ouNulo(apiFetch<FimPlantaoSalvo | null>(`/fim-plantao?${new URLSearchParams({ data, equipe }).toString()}`, { cache: 'no-store' }));
}

/** O último relatório antes da data: repete o que continua com alteração (ex.: hidrômetro travado). */
export function obterFimPlantaoAnterior(data: string): Promise<FimPlantaoSalvo | null> {
  return ouNulo(apiFetch<FimPlantaoSalvo | null>(`/fim-plantao/anterior?${new URLSearchParams({ data }).toString()}`, { cache: 'no-store' }));
}

export function salvarFimPlantao(input: {
  data: string;
  equipe: string;
  dados: DadosFimPlantao;
  mensagem: string;
}): Promise<FimPlantaoSalvo> {
  return apiFetch<FimPlantaoSalvo>('/fim-plantao', { method: 'PUT', body: JSON.stringify(input) });
}
