import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas e as datas caem no formulário de troca de serviço (1 página, layout fixo).
 * Posições calibradas no sandbox em 07/11/2026: o usuário ajustou cada campo à mão no painel do
 * Autentique ("Alterar campos") e os valores abaixo foram lidos pela API (x/y em % da página A4,
 * canto de cima à esquerda da caixa do Autentique). Conferido no PDF assinado.
 */
export const ESCALA_ASSINATURA_TROCA = 0.8;

export type PapelTroca = 'Solicitante' | 'Solicitado' | 'Chefe do solicitante' | 'Chefe do solicitado' | 'Gerente';
export const PAPEIS_TROCA: PapelTroca[] = ['Solicitante', 'Solicitado', 'Chefe do solicitante', 'Chefe do solicitado', 'Gerente'];

/** Assinatura de cada papel e, para três deles, a data (Solicitado em / Acordado em / Data de entrega). */
const CAMPOS: Record<PapelTroca, { assinatura: { x: string; y: string }; data?: { x: string; y: string } }> = {
  Solicitante: { assinatura: { x: '15.37', y: '45.31' }, data: { x: '18.61', y: '50.61' } },
  Solicitado: { assinatura: { x: '60.73', y: '45.40' }, data: { x: '65.00', y: '50.61' } },
  'Chefe do solicitante': { assinatura: { x: '14.99', y: '59.30' } },
  'Chefe do solicitado': { assinatura: { x: '60.61', y: '59.12' } },
  Gerente: { assinatura: { x: '39.05', y: '89.47' }, data: { x: '32.03', y: '80.22' } },
};

function campo(posicao: { x: string; y: string }, element: PosicaoAutentique['element'], scale: number): PosicaoAutentique {
  return { x: posicao.x, y: posicao.y, z: 1, angle: 0, scale, element };
}

/** Assinatura (e data, quando houver) de cada papel que a pessoa ocupa na troca. */
export function posicoesTroca(papeis: string[]): PosicaoAutentique[] {
  const posicoes: PosicaoAutentique[] = [];
  for (const papel of PAPEIS_TROCA) {
    if (!papeis.includes(papel)) continue;
    const { assinatura, data } = CAMPOS[papel];
    posicoes.push(campo(assinatura, 'SIGNATURE', ESCALA_ASSINATURA_TROCA));
    if (data) posicoes.push(campo(data, 'DATE', 1));
  }
  return posicoes;
}
