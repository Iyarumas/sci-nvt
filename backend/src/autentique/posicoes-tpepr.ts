import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no TP/EPR (A4 deitado, 1 página, layout fixo de
 * frontend/src/services/tpeprPdfService.ts). A tabela tem sempre 12 linhas, então as duas linhas
 * de assinatura ficam sempre no mesmo lugar:
 *   tabela termina em 61 + 23 + 12 × 5,8 = 153,6 mm; o traço fica 31,5 mm abaixo → 185,1 mm.
 *   Chefe de Equipe: traço de 60 a 132 mm (centro 96). Gerente: de 201 a 273 mm (centro 237).
 * Mesma conversão do LRO (caixa do Autentique começa acima e antes do centro do traço).
 * (A calibrar no sandbox, como foi feito no PTR-BA, LRO e troca.)
 */
export const ESCALA_ASSINATURA_TPEPR = 0.8;
const ACIMA_DA_LINHA_MM = 14.65;
const ANTES_DO_CENTRO_MM = 25.1;
const PAGINA = { largura: 297, altura: 210 };
const LINHA_Y_MM = 185.1;
const CENTRO_X_MM = { chefe: 96, gerente: 237 } as const;

export type PapelTpepr = keyof typeof CENTRO_X_MM;

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();

export function posicaoTpepr(papel: PapelTpepr): PosicaoAutentique {
  return {
    x: pct(CENTRO_X_MM[papel] - ANTES_DO_CENTRO_MM * ESCALA_ASSINATURA_TPEPR, PAGINA.largura),
    y: pct(LINHA_Y_MM - ACIMA_DA_LINHA_MM * ESCALA_ASSINATURA_TPEPR, PAGINA.altura),
    z: 1,
    angle: 0,
    scale: ESCALA_ASSINATURA_TPEPR,
    element: 'SIGNATURE',
  };
}
