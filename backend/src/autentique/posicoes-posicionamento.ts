import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no Exercício de Posicionamento (A4 em pé, 1 página, layout fixo de
 * frontend/src/services/exercicioPosicionamentoPdfService.ts). O layout não muda com o tamanho dos
 * textos: as células têm altura fixa e o texto diminui ou é cortado para caber, então as posições
 * valem para qualquer exercício.
 * - viaturas (Faísca 2, Faísca 3, CRS): linhas de 19,5 mm com topo em 54, 73,5 e 93 mm;
 *   coluna "Assinatura" do BA-MC a partir de 58 mm; da equipagem a partir de 130 mm;
 * - rodapé: traço em 268,9 mm; BA-CE centro 58 mm, GS centro 152 mm.
 * Calibrado no sandbox em 09/11/2026: o usuário ajustou cada assinatura à mão no painel do
 * Autentique e os valores foram lidos pela API (x/y = canto de cima à esquerda da caixa).
 */
const PAGINA = { largura: 210, altura: 297 };
const VIATURAS_TOPO = [54, 73.5, 93];
const MOTORISTA = { x: 60.3, abaixoDoTopo: 1.7, escala: 0.7 };
/** Equipagem: x da caixa e, por quantidade de pessoas, onde começa (em relação ao topo da viatura) e o passo. */
const EQUIPAGEM = {
  x: 130.7,
  escala: 0.5, // o Autentique não aceita escala menor que 0,5
  porQuantidade: { 1: { inicio: 2.3, passo: 0 }, 2: { inicio: -2.4, passo: 9.45 }, 3: { inicio: -4.7, passo: 7.15 } } as Record<number, { inicio: number; passo: number }>,
};
const RODAPE = { linhaY: 268.9, centroX: { chefe: 58, gerente: 152 }, acimaDaLinha: 14.65, antesDoCentro: 25.1, escala: 0.8 };

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();

function posicao(xMm: number, yMm: number, scale: number): PosicaoAutentique {
  return { x: pct(xMm, PAGINA.largura), y: pct(yMm, PAGINA.altura), z: 1, angle: 0, scale, element: 'SIGNATURE' };
}

/** Assinatura do BA-MC (motorista) na coluna dele, na linha da viatura (0 = Faísca 2, 1 = Faísca 3, 2 = CRS). */
export function posicaoMotorista(viatura: number): PosicaoAutentique {
  return posicao(MOTORISTA.x, VIATURAS_TOPO[viatura] + MOTORISTA.abaixoDoTopo, MOTORISTA.escala);
}

/** Assinatura da pessoa `indice` de `total` da equipagem, na altura do nome dela. */
export function posicaoEquipagem(viatura: number, indice: number, total: number): PosicaoAutentique {
  const regra = EQUIPAGEM.porQuantidade[Math.min(Math.max(total, 1), 3)];
  return posicao(EQUIPAGEM.x, VIATURAS_TOPO[viatura] + regra.inicio + regra.passo * indice, EQUIPAGEM.escala);
}

/** Assinatura no traço do rodapé (BA-CE ou GS). */
export function posicaoRodapePosicionamento(papel: 'chefe' | 'gerente'): PosicaoAutentique {
  return posicao(
    RODAPE.centroX[papel] - RODAPE.antesDoCentro * RODAPE.escala,
    RODAPE.linhaY - RODAPE.acimaDaLinha * RODAPE.escala,
    RODAPE.escala,
  );
}
