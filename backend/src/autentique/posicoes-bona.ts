import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde as assinaturas caem no BONA. A folha cresce com o texto (o campo de assinatura pode ir para a
 * 2ª página), então quem gera o PDF (frontend/src/services/bonaPdfService.ts) mede a página e o lugar
 * de cada assinatura no campo "Assinatura do Chefe de Equipe" e manda junto, como no LRO.
 * Chefe de equipe sempre; BA-LR ao lado dele quando participou.
 * Mesma conversão do LRO (caixa do Autentique começa acima e antes do ponto). (A calibrar no sandbox.)
 */
export const ESCALA_ASSINATURA_BONA = 0.7;
const ACIMA_DA_LINHA_MM = 14.65;
const ANTES_DO_CENTRO_MM = 25.1;
const PAGINA = { largura: 210, altura: 297 };

export type PapelBona = 'chefe' | 'lr';

export interface LinhaAssinaturaBona {
  papel: PapelBona;
  pagina: number;
  linhaYMm: number;
  centroXMm: number;
}

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Confere o que veio do navegador: números dentro da página, uma linha por papel. */
export function validarLinhasBona(valor: unknown): LinhaAssinaturaBona[] {
  if (!Array.isArray(valor)) return [];
  const linhas: LinhaAssinaturaBona[] = [];
  for (const item of valor) {
    const l = item as Partial<LinhaAssinaturaBona>;
    if (l?.papel !== 'chefe' && l?.papel !== 'lr') continue;
    const pagina = Number(l.pagina);
    const y = Number(l.linhaYMm);
    const x = Number(l.centroXMm);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 20) continue;
    if (!Number.isFinite(y) || y < 0 || y > PAGINA.altura) continue;
    if (!Number.isFinite(x) || x < 0 || x > PAGINA.largura) continue;
    if (linhas.some(existente => existente.papel === l.papel)) continue;
    linhas.push({ papel: l.papel, pagina, linhaYMm: y, centroXMm: x });
  }
  return linhas;
}

export function posicaoNaLinhaBona(linha: LinhaAssinaturaBona): PosicaoAutentique {
  const x = limitar(linha.centroXMm - ANTES_DO_CENTRO_MM * ESCALA_ASSINATURA_BONA, 0, PAGINA.largura - 10);
  const y = limitar(linha.linhaYMm - ACIMA_DA_LINHA_MM * ESCALA_ASSINATURA_BONA, 0, PAGINA.altura - 10);
  return { x: pct(x, PAGINA.largura), y: pct(y, PAGINA.altura), z: linha.pagina, angle: 0, scale: ESCALA_ASSINATURA_BONA, element: 'SIGNATURE' };
}
