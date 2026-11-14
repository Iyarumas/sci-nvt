/**
 * Acha QUAL curso/documento é a partir do texto do próprio certificado (não do nome do arquivo).
 * Assim "NR35 NAVEGANTES.pdf", "Certificado trabalho em altura.pdf" e "05 - nr-35.pdf" viram todos "NR 35".
 *
 * Regra: procura no começo do texto (onde fica o título do certificado) e fica com o curso que
 * aparece PRIMEIRO. NR vale por "NR 35", "NR-35" ou "Norma Regulamentadora nº 35".
 * Só conta o que está no catálogo abaixo ou nos tipos cadastrados na tela de validade.
 */

/** Quanto do começo do texto guardar/usar: o título do certificado fica no topo. */
export const TAMANHO_TRECHO_CURSO = 1500;

/** Nome no sistema → jeitos de aparecer escrito no certificado (sem acento, minúsculo). */
const CATALOGO: Array<{ tipo: string; termos: string[] }> = [
  { tipo: 'PRIMEIROS SOCORROS', termos: ['primeiros socorros'] },
  { tipo: 'GERENCIAMENTO DE FAUNA', termos: ['gerenciamento de fauna', 'gerenciamento do risco da fauna', 'risco da fauna', 'risco de fauna'] },
  { tipo: 'INTEGRAÇÃO DE SEGURANÇA', termos: ['integracao de seguranca'] },
  { tipo: 'COMPLIANCE', termos: ['compliance'] },
  { tipo: 'SGSO', termos: ['sgso', 'sistema de gerenciamento da seguranca operacional', 'sistema de gerenciamento de seguranca operacional'] },
  { tipo: 'AVSEC', termos: ['avsec', 'contra atos de interferencia ilicita'] },
  { tipo: 'APAM', termos: ['apam'] },
  { tipo: 'CVA', termos: ['cva'] },
  { tipo: 'CVE', termos: ['cve', 'condutor de veiculo de emergencia', 'condutores de veiculos de emergencia', 'condutor de veiculos de emergencia'] },
  { tipo: 'CAP BA + CBA AT', termos: ['cap ba', 'cap-ba', 'cba at', 'cba-at'] },
  { tipo: 'CHEFE DE EQUIPE (BA-CE)', termos: ['ba-ce', 'ba ce', 'bace'] },
  { tipo: 'MOTORISTA CONDUTOR (BA-MC)', termos: ['ba-mc', 'ba mc', 'bamc', 'motorista condutor'] },
];

/** Tipos genéricos demais para procurar no texto (aparecem em qualquer certificado). */
const NAO_PROCURAR = new Set(['FORMACAO', 'CNH', 'X6']);

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, ' ')
    .replace(/\s+/g, ' ');
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Posição da primeira vez que o termo aparece como palavra inteira (-1 se não aparece). */
function posicao(texto: string, termo: string): number {
  const m = new RegExp(`(^|[^a-z0-9])${escapar(termo)}(?=$|[^a-z0-9])`).exec(texto);
  return m ? m.index + m[1].length : -1;
}

/** "NR 35", "NR-35", "NR35", "Norma Regulamentadora n 35": todas as NRs do texto, com a posição. */
function todasNrs(texto: string): Array<{ tipo: string; pos: number }> {
  const re = /(?:^|[^a-z0-9])(?:nr|norma regulamentadora)\s*(?:n\.?|no\.?|numero)?\s*[-_.:]?\s*0?(\d{1,2})(?!\d)/g;
  const achadas: Array<{ tipo: string; pos: number }> = [];
  for (let m = re.exec(texto); m; m = re.exec(texto)) achadas.push({ tipo: `NR ${m[1].padStart(2, '0')}`, pos: m.index });
  return achadas;
}

/**
 * Cursos citados no começo do certificado, na ordem em que aparecem (sem repetir). [] = não deu para saber.
 * O primeiro costuma ser o título; mais de um deixa o caso em dúvida (a tela pede para o admin conferir).
 * `tiposCadastrados`: nomes de documentos configurados na tela (também são procurados no texto).
 */
export function acharCursos(texto: string, tiposCadastrados: string[] = []): string[] {
  const trecho = normalizarTexto(texto.slice(0, TAMANHO_TRECHO_CURSO))
    // "função: BA-MC" / "cargo: BA-CE" é o cargo da pessoa, não o curso.
    .replace(/(funcao|cargo)\s*[:\-]\s*[^\s,;]+/g, ' ');
  if (!trecho.trim()) return [];

  const candidatos: Array<{ tipo: string; pos: number }> = [...todasNrs(trecho)];

  for (const { tipo, termos } of CATALOGO) {
    const posicoes = termos.map(t => posicao(trecho, t)).filter(p => p >= 0);
    if (posicoes.length) candidatos.push({ tipo, pos: Math.min(...posicoes) });
  }

  const doCatalogo = new Set(CATALOGO.map(c => normalizarTexto(c.tipo)));
  for (const tipo of tiposCadastrados) {
    const termo = normalizarTexto(tipo).trim();
    if (!termo || termo.length < 3 || doCatalogo.has(termo) || /^nr\b/.test(termo)) continue;
    if (NAO_PROCURAR.has(termo.toUpperCase())) continue;
    const p = posicao(trecho, termo);
    if (p >= 0) candidatos.push({ tipo, pos: p });
  }

  candidatos.sort((a, b) => a.pos - b.pos);
  return [...new Set(candidatos.map(c => c.tipo))];
}
