import type { OrdemServico } from '../types/ordemServico';

type OrdemComData = Pick<OrdemServico, 'dataEmissao' | 'createdAt' | 'numero'>;

/** Emissao define a cronologia; o cadastro apenas desempata ordens do mesmo dia. */
export function compararOrdensServicoPorData(a: OrdemComData, b: OrdemComData): number {
  const dataA = (a.dataEmissao || a.createdAt || '').slice(0, 10);
  const dataB = (b.dataEmissao || b.createdAt || '').slice(0, 10);
  const porEmissao = dataB.localeCompare(dataA);
  if (porEmissao) return porEmissao;
  const cadastroA = Date.parse(a.createdAt) || 0;
  const cadastroB = Date.parse(b.createdAt) || 0;
  return cadastroB - cadastroA || b.numero.localeCompare(a.numero, 'pt-BR', { numeric: true });
}
