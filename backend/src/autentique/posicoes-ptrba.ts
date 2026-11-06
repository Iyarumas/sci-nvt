import type { PosicaoAutentique } from './autentique-api.service';

/**
 * Onde cada assinatura cai no PDF do PTR-BA (frontend/src/services/ptrbaCompletoPdfService.ts).
 * Calibrado no sandbox do Autentique em 05/11/2026 e aprovado pela equipe:
 * - o Autentique usa x/y (em % da página) como o canto de cima à esquerda de uma caixa
 *   que tem espaço em branco em cima; a assinatura aparece ~5 mm abaixo do y;
 * - tabela: linhas de 6,7 mm, a primeira com topo em 43,5 mm; coluna "ASSINATURA DO BA" a partir de 130 mm;
 * - linha do chefe de equipe: traço em 288,5 mm, de 58 a 152 mm.
 */
const PAGINA = { largura: 210, altura: 297 };
const TABELA = { topoPrimeiraLinha: 43.5, alturaLinha: 6.7, xAssinatura: 142.5, subirAssinatura: 4.95, escala: 0.75 };
const CHEFE = { x: 79.9, y: 276.35, escala: 1.0 };
export const PARTICIPANTES_FIXOS_EQUIPE = 10;

const pct = (mm: number, total: number) => (Math.round((mm / total) * 10000) / 100).toString();

function posicao(xMm: number, yMm: number, scale: number): PosicaoAutentique {
  return { x: pct(xMm, PAGINA.largura), y: pct(yMm, PAGINA.altura), z: 1, angle: 0, scale, element: 'SIGNATURE' };
}

export interface ParticipantePtrba {
  funcao?: string;
  nomeCompleto?: string;
  situacao?: string;
}

/** Mesma ordem de linhas do gerador: 10 vagas fixas da equipe (mesmo vazias) e depois os extras preenchidos. */
export function linhasDaTabela(participantes: ParticipantePtrba[], isApoc: boolean): ParticipantePtrba[] {
  if (isApoc) return participantes.filter(p => p.funcao === 'APOC' && String(p.nomeCompleto ?? '').trim());
  return [
    ...participantes.slice(0, PARTICIPANTES_FIXOS_EQUIPE),
    ...participantes.slice(PARTICIPANTES_FIXOS_EQUIPE).filter(p => String(p.nomeCompleto ?? '').trim()),
  ];
}

/** Posições de uma pessoa: a(s) linha(s) dela na tabela e, se for o chefe, a linha do chefe. */
export function posicoesDaPessoa(params: {
  chave: string;
  linhas: ParticipantePtrba[];
  ehChefe: boolean;
  normalizar: (nome: string) => string;
}): PosicaoAutentique[] {
  const posicoes: PosicaoAutentique[] = [];
  params.linhas.forEach((linha, i) => {
    if (params.normalizar(String(linha.nomeCompleto ?? '')) !== params.chave) return;
    if (String(linha.situacao ?? '').trim().toUpperCase() === 'A') return; // ausente não assina
    const topo = TABELA.topoPrimeiraLinha + TABELA.alturaLinha * i;
    posicoes.push(posicao(TABELA.xAssinatura, topo - TABELA.subirAssinatura, TABELA.escala));
  });
  if (params.ehChefe) posicoes.push(posicao(CHEFE.x, CHEFE.y, CHEFE.escala));
  return posicoes;
}
