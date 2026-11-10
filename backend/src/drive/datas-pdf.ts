/**
 * Acha a data do curso (e a validade, quando o documento traz) no texto de um certificado.
 * Padrões vistos nos certificados reais:
 *   "realizado em 16/12/2025"                     (cursos ASUR)
 *   "Data de Conclusão: Brasília/DF, 10 de julho de 2026"   (NRs)
 *   "no período de 20 de outubro de 2025 a 26 de outubro de 2025"  (CAP BA / CBA-AT) → data final
 *   "Porto Seguro, 16 de outubro de 2026."         (data de emissão no fim)
 * Ignora: nascimento, admissão, e o carimbo de impressão do navegador ("09/11/2026, 11:09").
 */
const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const DATA_NUMERICA = String.raw`(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})(?!\d)`;
const DATA_EXTENSO = String.raw`(\d{1,2})\s*(?:º|o)?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})`;
const QUALQUER_DATA = `(?:${DATA_NUMERICA}|${DATA_EXTENSO})`;

export interface DatasDoPdf {
  dataCurso: string | null;
  validade: string | null;
  origem: string | null;
}

function paraISO(d: number, m: number, a: number): string | null {
  if (a < 100) a += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1990 || a > 2100) return null;
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Lê a primeira data de um trecho (número ou por extenso). */
function dataDe(trecho: string): string | null {
  const num = trecho.match(new RegExp(DATA_NUMERICA));
  const ext = trecho.match(new RegExp(DATA_EXTENSO, 'i'));
  const usarExtenso = ext && (!num || (ext.index ?? 0) < (num.index ?? 0));
  if (usarExtenso) {
    const mes = MESES[ext![2].toLowerCase()];
    return mes ? paraISO(Number(ext![1]), mes, Number(ext![3])) : null;
  }
  return num ? paraISO(Number(num[1]), Number(num[2]), Number(num[3])) : null;
}

function todasAsDatas(trecho: string): string[] {
  const datas: string[] = [];
  const re = new RegExp(QUALQUER_DATA, 'gi');
  for (const m of trecho.matchAll(re)) {
    const d = dataDe(m[0]);
    if (d) datas.push(d);
  }
  return datas;
}

export function acharDatas(textoBruto: string, hojeISO: string, aceitarSoltas: boolean): DatasDoPdf {
  const texto = textoBruto
    .replace(/\r/g, '')
    // carimbo de impressão "09/11/2026, 11:09" e datas com hora "30/05/2026 10:41:56"
    .replace(new RegExp(`${DATA_NUMERICA},?\\s+\\d{1,2}:\\d{2}(:\\d{2})?`, 'g'), ' ')
    .replace(/[ \t]+/g, ' ');
  const plano = texto.replace(/\n/g, ' ');
  const naoFutura = (d: string | null) => (d && d <= hojeISO ? d : null);

  // Validade escrita no documento
  const val = plano.match(new RegExp(`(?:v[áa]lid[oa] at[ée]|validade(?: do certificado)?|vencimento)\\s*[:\\-]?\\s*${QUALQUER_DATA}`, 'i'));
  const validade = val ? dataDe(val[0].replace(/^[^\d]+/, '')) : null;

  const regras: Array<{ origem: string; re: RegExp; pegar: (m: RegExpMatchArray) => string | null }> = [
    {
      origem: 'período',
      re: new RegExp(`(?:per[íi]odo de|realizad[oa] (?:na data de|de)|de)\\s+${QUALQUER_DATA}\\s*(?:a|à|até)\\s*${QUALQUER_DATA}`, 'i'),
      pegar: m => {
        const [inicio, fim] = todasAsDatas(m[0]);
        return naoFutura(fim ?? null) ?? naoFutura(inicio ?? null);
      },
    },
    { origem: 'conclusão', re: new RegExp(`data d[ae] conclus[ãa]o\\s*:?[^\\d]{0,40}${QUALQUER_DATA}`, 'i'), pegar: m => naoFutura(dataDe(m[0].replace(/^[^\d]+/, ''))) },
    { origem: 'realizado', re: new RegExp(`(?:realizad[oa]|conclu[íi]d[oa]|concluiu[^.]{0,120}?)\\s+(?:em|no dia)\\s+${QUALQUER_DATA}`, 'i'), pegar: m => naoFutura(dataDe(m[0].slice(m[0].search(/\d/)))) },
    { origem: 'emissão', re: new RegExp(`(?:emitido em|data de emiss[ãa]o|data)\\s*:?\\s*${QUALQUER_DATA}`, 'i'), pegar: m => naoFutura(dataDe(m[0].slice(m[0].search(/\d/)))) },
    { origem: 'local e data', re: new RegExp(`[A-ZÀ-Úa-zà-ú]+(?:/[A-Z]{2})?,\\s*${DATA_EXTENSO}`, 'gi'), pegar: m => naoFutura(dataDe(m[0].slice(m[0].search(/\d/)))) },
  ];

  for (const regra of regras) {
    const m = plano.match(regra.re);
    if (!m) continue;
    const d = regra.pegar(m);
    if (d) return { dataCurso: d, validade, origem: regra.origem };
  }

  if (aceitarSoltas) {
    // Última tentativa: a data mais recente que não seja nascimento/admissão nem futura.
    const limpo = plano.replace(new RegExp(`(?:nascimento|nascido|admiss[ãa]o|nasc\\.)\\s*:?\\s*${QUALQUER_DATA}`, 'gi'), ' ');
    const datas = todasAsDatas(limpo).filter(d => d <= hojeISO).sort();
    if (datas.length) return { dataCurso: datas[datas.length - 1], validade, origem: 'data no texto' };
  }
  return { dataCurso: null, validade, origem: null };
}
