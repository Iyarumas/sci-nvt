import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no LRO. O LRO muda de tamanho todo dia, então quem gera o PDF
 * (frontend/src/services/lroGenerator.ts) mede a página e a altura de cada linha de assinatura
 * e manda junto. Aqui só convertemos a linha na caixa do Autentique.
 *
 * O Autentique usa x/y como o canto de cima à esquerda de uma caixa com espaço em branco em cima.
 * Na linha do chefe do PTR-BA (escala 1,0) a caixa ficou 12,15 mm acima do traço e começando
 * 25,1 mm antes do centro dele; aqui usamos a mesma proporção na escala do LRO.
 * (A calibrar no sandbox, como foi feito no PTR-BA.)
 */
export const ESCALA_ASSINATURA_LRO = 0.8;
// No 1º teste do LRO (07/11/2026) a assinatura encostou no traço: sobe ~2 mm (2,5 mm antes da escala).
const ACIMA_DA_LINHA_MM = 14.65;
const ANTES_DO_CENTRO_MM = 25.1;
const PAGINA = { largura: 210, altura: 297 };

export type PapelLro = 'chefe' | 'gerente';

export interface LinhaAssinaturaLro {
  papel: PapelLro;
  pagina: number;
  linhaYMm: number;
  centroXMm: number;
}

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Confere o que veio do navegador: números dentro da página, uma linha por papel. */
export function validarLinhasLro(valor: unknown): LinhaAssinaturaLro[] {
  if (!Array.isArray(valor)) return [];
  const linhas: LinhaAssinaturaLro[] = [];
  for (const item of valor) {
    const l = item as Partial<LinhaAssinaturaLro>;
    if (l?.papel !== 'chefe' && l?.papel !== 'gerente') continue;
    const pagina = Number(l.pagina);
    const y = Number(l.linhaYMm);
    const x = Number(l.centroXMm);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 60) continue;
    if (!Number.isFinite(y) || y < 0 || y > PAGINA.altura) continue;
    if (!Number.isFinite(x) || x < 0 || x > PAGINA.largura) continue;
    if (linhas.some(existente => existente.papel === l.papel)) continue;
    linhas.push({ papel: l.papel, pagina, linhaYMm: y, centroXMm: x });
  }
  return linhas;
}

export function posicaoNaLinhaLro(linha: LinhaAssinaturaLro): PosicaoAutentique {
  const x = limitar(linha.centroXMm - ANTES_DO_CENTRO_MM * ESCALA_ASSINATURA_LRO, 0, PAGINA.largura - 10);
  const y = limitar(linha.linhaYMm - ACIMA_DA_LINHA_MM * ESCALA_ASSINATURA_LRO, 0, PAGINA.altura - 10);
  return {
    x: pct(x, PAGINA.largura),
    y: pct(y, PAGINA.altura),
    z: linha.pagina,
    angle: 0,
    scale: ESCALA_ASSINATURA_LRO,
    element: 'SIGNATURE',
  };
}
