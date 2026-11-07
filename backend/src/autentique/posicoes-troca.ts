import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas e as datas caem no formulário de troca de serviço (1 página, layout fixo).
 * As caixas abaixo são as mesmas do preenchimento do PDF em frontend/src/pages/Relatorios/Trocas.tsx
 * (pdfPosition, em mm). O Autentique ancora x/y no canto de cima à esquerda de uma caixa com espaço
 * em branco em cima; os deslocamentos foram calibrados no sandbox.
 */
const PAGINA = { largura: 210, altura: 297 };
export const ESCALA_ASSINATURA_TROCA = 0.8;
/** Assinatura: começa um pouco para dentro da caixa e sobe para a ponta da tinta encostar na linha. */
const AJUSTE_ASSINATURA = { x: 10, y: -8 };
/** Data: no começo da caixa de data. */
const AJUSTE_DATA = { x: 0, y: -2 };

export type PapelTroca = 'Solicitante' | 'Solicitado' | 'Chefe do solicitante' | 'Chefe do solicitado' | 'Gerente';
export const PAPEIS_TROCA: PapelTroca[] = ['Solicitante', 'Solicitado', 'Chefe do solicitante', 'Chefe do solicitado', 'Gerente'];

/** Caixas do formulário (mm): assinatura de cada papel e, para três deles, a data. */
const CAIXAS: Record<PapelTroca, { assinatura: { x: number; y: number }; data?: { x: number; y: number } }> = {
  Solicitante: { assinatura: { x: 22, y: 147 }, data: { x: 42, y: 153.1 } },
  Solicitado: { assinatura: { x: 117, y: 147 }, data: { x: 141, y: 153.1 } },
  'Chefe do solicitante': { assinatura: { x: 22, y: 188 } },
  'Chefe do solicitado': { assinatura: { x: 117, y: 188 } },
  Gerente: { assinatura: { x: 72, y: 280 }, data: { x: 76, y: 240 } },
};

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function caixa(xMm: number, yMm: number, element: PosicaoAutentique['element'], scale: number): PosicaoAutentique {
  return {
    x: pct(limitar(xMm, 0, PAGINA.largura - 10), PAGINA.largura),
    y: pct(limitar(yMm, 0, PAGINA.altura - 10), PAGINA.altura),
    z: 1,
    angle: 0,
    scale,
    element,
  };
}

/** Assinatura (e data, quando houver) de cada papel que a pessoa ocupa na troca. */
export function posicoesTroca(papeis: string[]): PosicaoAutentique[] {
  const posicoes: PosicaoAutentique[] = [];
  for (const papel of PAPEIS_TROCA) {
    if (!papeis.includes(papel)) continue;
    const { assinatura, data } = CAIXAS[papel];
    posicoes.push(caixa(assinatura.x + AJUSTE_ASSINATURA.x, assinatura.y + AJUSTE_ASSINATURA.y, 'SIGNATURE', ESCALA_ASSINATURA_TROCA));
    if (data) posicoes.push(caixa(data.x + AJUSTE_DATA.x, data.y + AJUSTE_DATA.y, 'DATE', 1));
  }
  return posicoes;
}
