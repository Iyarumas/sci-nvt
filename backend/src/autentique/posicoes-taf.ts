import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no TAF (A4 deitado, 1 página, layout fixo de
 * frontend/src/services/tafPdfService.ts):
 * - tabela: 11 linhas de 9,8 mm, a 1ª com topo em 36 + 22,5 = 58,5 mm; a linha N é a vaga pN;
 *   coluna ASSINATURA de 222 a 291 mm. Mesma conta do PTR-BA (x 12,5 mm dentro da coluna,
 *   caixa ~5 mm acima do topo), centralizada na linha mais alta do TAF;
 * - rodapé: traço em 198,5 mm; Chefe de Equipe centro 88,5 mm, Gestor do SESCINC centro 208,5 mm
 *   (mesma conversão do TP/EPR, conferida no sandbox).
 * (A calibrar no sandbox.)
 */
const PAGINA = { largura: 297, altura: 210 };
const TABELA = { topoPrimeiraLinha: 58.5, alturaLinha: 9.8, xAssinatura: 234.5, subirAssinatura: 3.4, escala: 0.75 };
const RODAPE = { linhaY: 198.5, centroX: { chefe: 88.5, gerente: 208.5 }, acimaDaLinha: 14.65, antesDoCentro: 25.1, escala: 0.8 };
export const VAGAS_TAF = 10;

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();

function posicao(xMm: number, yMm: number, scale: number): PosicaoAutentique {
  return { x: pct(xMm, PAGINA.largura), y: pct(yMm, PAGINA.altura), z: 1, angle: 0, scale, element: 'SIGNATURE' };
}

/** Assinatura na coluna ASSINATURA da linha (0 = vaga p1). */
export function posicaoLinhaTaf(linha: number): PosicaoAutentique {
  const topo = TABELA.topoPrimeiraLinha + TABELA.alturaLinha * linha;
  return posicao(TABELA.xAssinatura, topo - TABELA.subirAssinatura, TABELA.escala);
}

/** Assinatura no traço do rodapé (Chefe de Equipe ou Gestor do SESCINC). */
export function posicaoRodapeTaf(papel: 'chefe' | 'gerente'): PosicaoAutentique {
  return posicao(
    RODAPE.centroX[papel] - RODAPE.antesDoCentro * RODAPE.escala,
    RODAPE.linhaY - RODAPE.acimaDaLinha * RODAPE.escala,
    RODAPE.escala,
  );
}
