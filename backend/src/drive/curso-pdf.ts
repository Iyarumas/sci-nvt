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
  { tipo: 'CHEFE DE EQUIPE (BA-CE)', termos: ['ba-ce', 'ba ce', 'bace', 'cba-ce', 'cba ce', 'chefe de equipe'] },
  { tipo: 'MOTORISTA CONDUTOR (BA-MC)', termos: ['ba-mc', 'ba mc', 'bamc', 'cba-mc', 'cba mc', 'motorista condutor'] },
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
  // O título ("concluiu o curso X com carga horária...") vale mais que o resto do texto: um certificado
  // de "Valores Humanos em Foco" que cita primeiros socorros no conteúdo não é de Primeiros Socorros.
  const titulo = acharTituloCurso(texto);
  if (titulo) {
    const doTitulo = procurarCursos(titulo, tiposCadastrados);
    if (doTitulo.length) return doTitulo;
    // Título sem nome conhecido ("Segurança para trabalhos em altura"): só a NR citada no texto vale.
    return procurarCursos(texto, tiposCadastrados).filter(c => /^NR \d/.test(c)).slice(0, 1);
  }
  return procurarCursos(texto, tiposCadastrados);
}

function procurarCursos(texto: string, tiposCadastrados: string[]): string[] {
  const trecho = normalizarTexto(texto.slice(0, TAMANHO_TRECHO_CURSO))
    // "função: BA-MC" / "cargo: BA-CE" é o cargo da pessoa, não o curso.
    .replace(/(funcao|cargo)\s*[:-]\s*[^\s,;]+/g, ' ');
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

/** Onde o título do curso termina: "com carga horária", "realizado em", "na modalidade"... */
const FIM_DO_TITULO = /[,;]|\s+com\s+(?:a\s+)?carga|\s+carga\s+hor|\s+realizad|\s+na\s+modalidade|\s+no\s+per[ií]odo|\s+em\s+conformidade|\s+de\s+acordo|\s+promovid|\s+autorizad|\s+data\s+d|\s+conclu[ií]d|\s+com\s+in[ií]cio|\s+com\s+dura|\s+--\s|\s+ministrad|\s+no\s+dia|\s+em\s+\d/i;

/** Restos que não são título (data, CPF, rodapé do gerador de PDF). */
const NAO_E_TITULO = /powered|tcpdf|cpf|^\d|\bde\s+\d{4}\b/i;

/**
 * Título do curso como está escrito no certificado ("concluiu o curso Valores Humanos em Foco: Ética e
 * Integridade com a carga horária..." → "VALORES HUMANOS EM FOCO: ÉTICA E INTEGRIDADE"), mesmo que o
 * sistema não conheça o curso. null quando o texto não tem a frase de conclusão/participação.
 */
export function acharTituloCurso(texto: string): string | null {
  const trecho = texto.slice(0, TAMANHO_TRECHO_CURSO).replace(/\s+/g, ' ');
  const m = /(?:conclu[ií]u|participou|realizou|concluiu\s+com\s+\S+)[^.]{0,60}?\b(?:curso|treinamento)\s+(?:de\s+|do\s+|da\s+)?(.{3,160})/i.exec(trecho);
  if (!m) return null;
  const titulo = m[1].split(FIM_DO_TITULO)[0].replace(/[\s:–-]+$/, '').trim();
  if (titulo.length < 3 || titulo.length > 90 || NAO_E_TITULO.test(titulo)) return null;
  return titulo.toLocaleUpperCase('pt-BR');
}
