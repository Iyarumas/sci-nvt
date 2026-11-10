import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no Tempo Resposta (A4 em pé, 1 página, layout fixo de
 * frontend/src/services/tempoRespostaPdfService.ts; os textos diminuem para caber, a folha não muda):
 * - viaturas (Faísca 2, Faísca 3): linhas de 34,5 mm com topo em 53,3 e 87,8 mm;
 *   coluna "Assinatura" do BA-MC a partir de 47 mm; da equipagem a partir de 108 mm;
 * - rodapé: traço em 285,4 mm; BA-CE à esquerda, GS/EMBAIXADOR à direita.
 * Calibrado no sandbox em 10/11/2026: o usuário ajustou cada assinatura à mão no painel do
 * Autentique e os valores foram lidos pela API (x/y = canto de cima à esquerda da caixa).
 * A equipagem do CRS só testemunha e não tem marca na folha.
 */
const PAGINA = { largura: 210, altura: 297 };
const VIATURAS_TOPO = [53.3, 87.8];
const MOTORISTA = { x: 42.55, abaixoDoTopo: 9.35, escala: 0.7 };
/** Equipagem: x da caixa e, por quantidade de pessoas, onde começa (em relação ao topo da viatura) e o passo. */
const EQUIPAGEM = {
  x: 100.15,
  escala: 0.5, // o Autentique não aceita escala menor que 0,5
  porQuantidade: { 1: { inicio: 9.3, passo: 0 }, 2: { inicio: 3.05, passo: 12.45 } } as Record<number, { inicio: number; passo: number }>,
};
const RODAPE = { y: 274.2, x: { chefe: 35.6, gerente: 133.7 }, escala: 0.8 };

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();

function posicao(xMm: number, yMm: number, scale: number): PosicaoAutentique {
  return { x: pct(xMm, PAGINA.largura), y: pct(yMm, PAGINA.altura), z: 1, angle: 0, scale, element: 'SIGNATURE' };
}

/** Assinatura do BA-MC (motorista) na coluna dele (0 = Faísca 2, 1 = Faísca 3). */
export function posicaoMotoristaTempoResposta(viatura: number): PosicaoAutentique {
  return posicao(MOTORISTA.x, VIATURAS_TOPO[viatura] + MOTORISTA.abaixoDoTopo, MOTORISTA.escala);
}

/** Assinatura da pessoa `indice` de `total` da equipagem, na altura do nome dela. */
export function posicaoEquipagemTempoResposta(viatura: number, indice: number, total: number): PosicaoAutentique {
  const regra = EQUIPAGEM.porQuantidade[Math.min(Math.max(total, 1), 2)];
  return posicao(EQUIPAGEM.x, VIATURAS_TOPO[viatura] + regra.inicio + regra.passo * indice, EQUIPAGEM.escala);
}

/** Assinatura no traço do rodapé (BA-CE ou GS/EMBAIXADOR). */
export function posicaoRodapeTempoResposta(papel: 'chefe' | 'gerente'): PosicaoAutentique {
  return posicao(RODAPE.x[papel], RODAPE.y, RODAPE.escala);
}
