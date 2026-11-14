/**
 * Documentos do Google Drive na tela de Certificações.
 *
 * Por enquanto a tela roda com DADOS DE EXEMPLO (gerados a partir do id da pessoa) enquanto a conta
 * de leitura do Google não existe. Quando o servidor estiver ligado ao Drive, só `documentosDaPessoa`
 * passa a vir da API; as regras de validade e a tela continuam as mesmas.
 * Plano completo em docs/drive-documentos.md.
 */

export interface PastaDrive {
  id: string;
  nome: string;
}

/** As subpastas de cada pessoa no Drive, no mesmo nome e na mesma ordem. */
export const PASTAS_DRIVE: PastaDrive[] = [
  { id: '01', nome: '01 - Documentação Técnica' },
  { id: '02', nome: '02 - Cursos Internos ASUR' },
  { id: '03', nome: '03 - Cursos Med+' },
  { id: '04', nome: '04 - Cursos Extras' },
  { id: '05', nome: '05 - Recursos Humanos' },
  { id: '06', nome: '06 - Credenciamento' },
];

/**
 * Documentos cuja validade vem do CADASTRO da pessoa no sistema (não do prazo em meses):
 * CNH → cnhValidade; credencial aeroportuária → credencialValidade.
 */
export const TIPO_CREDENCIAL = 'CREDENCIAL AEROPORTUÁRIA';
export const TIPOS_COM_VALIDADE_PROPRIA = ['CNH', TIPO_CREDENCIAL];

/** Documentos cujo prazo conta a partir da data de vencimento escrita neles (conta de luz/água etc.). */
export const TIPOS_PRAZO_PELO_VENCIMENTO = ['COMPROVANTE DE RESIDÊNCIA'];

/** Com quantos meses antes de vencer o card fica amarelo. Cursos internos ASUR (base da credencial): 4. */
const MESES_AVISO_PADRAO = 3;
const MESES_AVISO_POR_PASTA: Record<string, number> = { '02': 4 };

/** Pasta dos cursos extras: não precisam de cadastro nem de prazo. */
export const PASTA_EXTRAS = '04';

export interface ArquivoDrive {
  id: string;
  pastaId: string;
  /** Nome do arquivo como está no Drive. */
  nomeArquivo: string;
  /** Tipo do documento (ex.: "NR 35"): Nº padrão da pasta, curso lido no certificado ou nome do arquivo. */
  tipo: string;
  /** O tipo veio do texto do certificado (e não do nome do arquivo). */
  tipoPeloConteudo?: boolean;
  formato: 'pdf' | 'imagem' | 'outro';
  /** Data do curso/emissão (lida do PDF ou informada no card). */
  dataCurso: string | null;
  /** Validade escrita no próprio PDF (usada quando o documento não tem prazo em meses). */
  validadeTexto?: string | null;
  /** De onde veio a data: "realizado", "conclusão", "período", "informada"… */
  origemData?: string | null;
  /** O servidor já tentou ler a data deste arquivo. */
  dataLida?: boolean;
  /** Validade escrita no próprio documento (ex.: CNH). Tem prioridade sobre o prazo em meses. */
  validadePropria?: string | null;
  /** Bloco de notas com o nome do documento: na pasta é o aviso de que o documento falta. */
  marcadorFalta?: boolean;
}

/** Prazo de cada tipo de documento, em meses. 0 = não vence; null = ainda não definido. */
export type PrazosDocumentos = Record<string, number | null>;

export interface DocumentoAdicionado {
  tipo: string;
  pastaId: string;
}

export interface ConfigDocumentos {
  prazos: PrazosDocumentos;
  obrigatorios: string[];
  /** Documentos que o administrador cadastrou à mão numa pasta (mesmo que ninguém tenha o arquivo ainda). */
  adicionados?: DocumentoAdicionado[];
  /** Nº padrão de cada documento na pasta: padroes["01"]["05"] = "CNH". Vale mais que o nome do arquivo. */
  padroes?: Record<string, Record<string, string>>;
  /** Nomes juntados: apelidos["COMLIANCE"] = "COMPLIANCE". */
  apelidos?: Record<string, string>;
  /** Para quais cargos o documento é obrigatório (vazio/sem entrada = todos). Ex.: CVE → ["BA-MC"]. */
  cargosObrigatorio?: Record<string, string[]>;
}

export const CARGOS_DOCUMENTOS = ['BA-2', 'BA-MC', 'BA-CE', 'BA-LR', 'BA-RE', 'GS', 'OC'] as const;

/** Obrigatórios por cargo já combinados com o usuário. */
export const CARGOS_OBRIGATORIO_INICIAIS: Record<string, string[]> = {
  CVE: ['BA-MC'],
  'MOTORISTA CONDUTOR (BA-MC)': ['BA-MC'],
  'CHEFE DE EQUIPE (BA-CE)': ['BA-CE', 'BA-LR'],
};

/** O documento é obrigatório para quem tem esse cargo? */
export function obrigatorioPara(tipo: string, cargo: string | null | undefined, config: ConfigDocumentos): boolean {
  if (!config.obrigatorios.includes(tipo)) return false;
  const cargos = config.cargosObrigatorio?.[tipo];
  return !cargos || cargos.length === 0 || (!!cargo && cargos.includes(cargo));
}

/** Padrão de nomes e números das pastas, como está no Drive. */
export const PADROES_INICIAIS: Record<string, Record<string, string>> = {
  '01': {
    '01': 'FORMAÇÃO', '02': 'CAP BA + CBA AT', '03': 'CHEFE DE EQUIPE (BA-CE)', '04': 'MOTORISTA CONDUTOR (BA-MC)',
    '05': 'CNH', '06': 'CVE', '07': 'X6', '08': 'PRIMEIROS SOCORROS',
  },
  '02': {
    '01': 'APAM', '02': 'AVSEC', '03': 'CVA', '04': 'SGSO', '05': 'GERENCIAMENTO DE FAUNA',
    '06': 'INTEGRAÇÃO DE SEGURANÇA', '07': 'COMPLIANCE',
  },
  '03': {
    '02': 'NR 06', '03': 'NR 10', '04': 'NR 12', '05': 'NR 17', '06': 'NR 18', '07': 'NR 20', '08': 'NR 20 II',
    '09': 'NR 23', '10': 'NR 32', '11': 'NR 33', '12': 'NR 35',
  },
};

/** Posição do documento na pasta pelo Nº padrão (sem Nº = fim). Mudar o Nº muda a ordem. */
export function posicaoNaPasta(pastaId: string, tipo: string, config: ConfigDocumentos): number {
  const daPasta = config.padroes?.[pastaId] ?? {};
  const numero = Object.keys(daPasta).find(n => daPasta[n] === tipo);
  return numero ? Number(numero) : Number.MAX_SAFE_INTEGER;
}

/** Número da frente do arquivo ("04B - CURSO BAMC" → "04"). */
export function numeroDoArquivo(nomeArquivo: string): string | null {
  const m = nomeArquivo.match(/^\s*(\d{1,3})[A-Z]?\s*[-–.]/i);
  return m ? m[1].padStart(2, '0') : null;
}

/**
 * Tipo final do documento: Nº padrão da pasta (só nos arquivos soltos na pasta) → curso lido no texto
 * do certificado → nome do arquivo (com os nomes juntados).
 */
export function resolverTipo(
  nomeArquivo: string, pastaId: string, nomePessoa: string, config: ConfigDocumentos, naRaizDaPasta = true,
  cursoLido: string | null = null,
): string {
  return resolverTipoComOrigem(nomeArquivo, pastaId, nomePessoa, config, naRaizDaPasta, cursoLido).tipo;
}

export function resolverTipoComOrigem(
  nomeArquivo: string, pastaId: string, nomePessoa: string, config: ConfigDocumentos, naRaizDaPasta = true,
  cursoLido: string | null = null,
): { tipo: string; peloConteudo: boolean } {
  const numero = naRaizDaPasta ? numeroDoArquivo(nomeArquivo) : null;
  const doNumero = numero ? config.padroes?.[pastaId]?.[numero] : undefined;
  if (doNumero) return { tipo: doNumero, peloConteudo: false };
  const lido = tipoPeloNome(nomeArquivo, nomePessoa);
  const peloNome = config.apelidos?.[lido] ?? lido;
  if (cursoLido) {
    const doTexto = config.apelidos?.[cursoLido] ?? cursoLido;
    // O nome do arquivo é mais específico que o texto ("NR 20 II" no nome, "NR 20" no certificado): fica o nome.
    if (peloNome !== doTexto && peloNome.startsWith(`${doTexto} `)) return { tipo: peloNome, peloConteudo: false };
    return { tipo: doTexto, peloConteudo: doTexto !== peloNome };
  }
  return { tipo: peloNome, peloConteudo: false };
}

export type SituacaoDocumento = 'vencido' | 'vence' | 'emdia' | 'neutro' | 'falta';

export interface DocumentoAvaliado {
  /** O arquivo que vale (o de validade mais longa quando há mais de um do mesmo documento). */
  arquivo: ArquivoDrive | null;
  /** Todos os arquivos desse documento na pasta (ex.: "04 - CURSO BAMC" e "04B - CURSO BAMC"). */
  arquivos: ArquivoDrive[];
  tipo: string;
  pastaId: string;
  situacao: SituacaoDocumento;
  vencimento: string | null;
  texto: string;
}

/* ───────── Tipo do documento a partir do nome do arquivo ───────── */

/**
 * "05 - NR35 NAVEGANTES (1).pdf" → "NR 35"; "03 - APAM - FULANO.pdf" (credenciamento) → "APAM".
 * Tira o número da frente, a extensão, cópias "(1)" e o nome da pessoa.
 */
export function tipoPeloNome(nomeArquivo: string, nomePessoa = ''): string {
  let nome = nomeArquivo.replace(/\.[a-z0-9]{2,4}$/i, '');
  nome = nome.replace(/^\s*\d{1,3}[A-Z]?\s*[-–.]\s*/i, '');
  nome = nome.replace(/\(\d+\)/g, '');
  nome = nome
    .replace(/\[\s*assinado\s*\]/gi, '')
    .replace(/[\s_-]+c[oó]pia\b/gi, '')
    .replace(/[\s_-]+(rotated|edited)\b/gi, '')
    .replace(/\s+-\s+falta\s*$/i, '')
    .replace(/\.+\s*$/, '')
    // Certificados da plataforma: "NOVO_ONBORDING-CERTIFICADO___NOVO_ONBORDING_16906" → "NOVO ONBORDING"
    .replace(/(.{3,}?)[\s_-]*-?\s*CERTIFICADOS?[\s_].*$/i, '$1')
    .replace(/_+/g, ' ')
    .replace(/\s+\d{3,}(-\d+)?\s*$/, '');
  if (nomePessoa) {
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nomeTodo = nomePessoa.trim().split(/\s+/).map(escapar).join('\\s+');
    nome = nome.replace(new RegExp(nomeTodo, 'gi'), '');
    for (const parte of nomePessoa.split(/\s+/).filter(p => p.length > 2)) {
      nome = nome.replace(new RegExp(`(^|[\\s-])${escapar(parte)}(?=$|[\\s-])`, 'gi'), '$1');
    }
    // "DE", "DA", "DOS"… que sobraram do nome no fim
    nome = nome.replace(/(\s+(DE|DA|DO|DAS|DOS|E))+\s*$/i, '');
  }
  const nr = nome.match(/\bNR\s*[-_]?\s*(\d{1,2})(?:\s*[-_]?\s*(II|III|IV)\b)?/i);
  if (nr) return `NR ${nr[1].padStart(2, '0')}${nr[2] ? ` ${nr[2].toUpperCase()}` : ''}`;
  const limpo = nome.replace(/\s*[-–]\s*$/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s-–]+|[\s-–]+$/g, '').toUpperCase();
  return NOMES_CONHECIDOS[limpo] ?? limpo;
}

/** Abreviações usadas nos nomes dos arquivos → nome mostrado no sistema. */
const NOMES_CONHECIDOS: Record<string, string> = {
  PS: 'PRIMEIROS SOCORROS',
  'CURSO BACE': 'CHEFE DE EQUIPE (BA-CE)',
  BACE: 'CHEFE DE EQUIPE (BA-CE)',
  'CURSO BAMC': 'MOTORISTA CONDUTOR (BA-MC)',
  BAMC: 'MOTORISTA CONDUTOR (BA-MC)',
};

/**
 * Lê só os NOMES dos arquivos de uma pasta escolhida no computador (Google Drive montado no Windows).
 * Aceita a pasta da pessoa (com as subpastas 01…06) ou uma subpasta só. Nada é enviado.
 */
export function documentosDaPastaEscolhida(caminhos: string[]): Array<{ tipo: string; pastaId: string; arquivos: string[] }> {
  const achados = new Map<string, { tipo: string; pastaId: string; arquivos: string[] }>();
  for (const caminho of caminhos) {
    const partes = caminho.split('/');
    const nomeArquivo = partes[partes.length - 1];
    if (arquivoIgnorado(nomeArquivo)) continue;
    const indicePasta = partes.slice(0, -1).findIndex(p => /^0?[1-6]\s*-/.test(p));
    if (indicePasta < 0) continue;
    const pastaId = partes[indicePasta].match(/^0?([1-6])/)![1].padStart(2, '0');
    // A pasta acima da subpasta é a da pessoa: o nome dela sai do nome do arquivo (credenciamento).
    const nomePessoa = indicePasta > 0 ? partes[indicePasta - 1] : '';
    const tipo = tipoPeloNome(nomeArquivo, nomePessoa);
    if (!tipo) continue;
    const atual = achados.get(tipo) ?? { tipo, pastaId, arquivos: [] };
    atual.arquivos.push(nomeArquivo);
    achados.set(tipo, atual);
  }
  return [...achados.values()].sort((a, b) => a.pastaId.localeCompare(b.pastaId) || a.tipo.localeCompare(b.tipo));
}

/** Bloco de notas de aviso: o conteúdo é texto (um ".txt" que na verdade é PDF conta como documento). */
function ehMarcador(a: { nome: string; mime: string }): boolean {
  if (a.mime.includes('pdf') || a.mime.startsWith('image/')) return false;
  return /^text\//.test(a.mime) || /\.txt$/i.test(a.nome);
}

/** Converte o que o servidor leu do Drive para a tela. */
export function arquivosDoServidor(
  arquivos: Array<{
    id: string; nome: string; pasta: string; caminho: string[]; mime: string;
    dataCurso?: string | null; validadeTexto?: string | null; origemData?: string | null; dataLida?: boolean;
    /** Curso achado no texto do certificado pelo servidor. */
    cursoLido?: string | null;
  }>,
  nomePastaPessoa: string,
  config: ConfigDocumentos,
): ArquivoDrive[] {
  // "C - ALINE FABIANA LIMA" → nome da pessoa, para tirar dos nomes do credenciamento
  const nomePessoa = nomePastaPessoa.replace(/^\s*[A-Z]{1,2}\s*-\s*/i, '').replace(/\s+-\s+.*$/, '');
  return arquivos
    .filter(a => !arquivoIgnorado(a.nome) && !a.caminho.some(c => /anterior/i.test(c)))
    .filter(a => !(a.pasta === PASTA_EXTRAS && ehMarcador(a)))
    .map(a => {
      const texto = ehMarcador(a);
      const { tipo, peloConteudo } = resolverTipoComOrigem(a.nome, a.pasta, nomePessoa, config, a.caminho.length === 0, a.cursoLido ?? null);
      return {
        id: a.id,
        pastaId: a.pasta,
        nomeArquivo: a.nome,
        tipo,
        tipoPeloConteudo: peloConteudo,
        formato: a.mime.includes('pdf') ? 'pdf' as const : a.mime.startsWith('image/') ? 'imagem' as const : 'outro' as const,
        dataCurso: a.dataCurso ?? null,
        validadeTexto: a.validadeTexto ?? null,
        origemData: a.origemData ?? null,
        dataLida: a.dataLida ?? false,
        marcadorFalta: texto,
      };
    })
    .filter(a => !!a.tipo);
}

/** Arquivos que o Windows/Drive cria e não são documentos. */
export function arquivoIgnorado(nomeArquivo: string): boolean {
  return /^desktop(\.ini)?$/i.test(nomeArquivo) || /^\./.test(nomeArquivo) || /^thumbs\.db$/i.test(nomeArquivo);
}

/* ───────── Validade ───────── */

function somarMeses(dataISO: string, meses: number): string {
  const [a, m, d] = dataISO.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  const mm = String(alvo.getMonth() + 1).padStart(2, '0');
  const dd = String(alvo.getDate()).padStart(2, '0');
  return `${alvo.getFullYear()}-${mm}-${dd}`;
}

function diasAte(dataISO: string, hojeISO: string): number {
  const [a1, m1, d1] = dataISO.split('-').map(Number);
  const [a2, m2, d2] = hojeISO.split('-').map(Number);
  return Math.round((Date.UTC(a1, m1 - 1, d1) - Date.UTC(a2, m2 - 1, d2)) / 86400000);
}

const br = (iso: string) => iso.split('-').reverse().join('/');

export function avaliarArquivo(arquivo: ArquivoDrive, config: ConfigDocumentos, hojeISO: string): DocumentoAvaliado {
  const base = { arquivo, arquivos: [arquivo], tipo: arquivo.tipo, pastaId: arquivo.pastaId };
  if (arquivo.marcadorFalta) return { ...base, situacao: 'falta', vencimento: null, texto: 'Falta · marcado na pasta' };
  const prazo = config.prazos[arquivo.tipo];
  // Comprovante de residência: o prazo conta do vencimento da conta, não da data de um curso.
  if (TIPOS_PRAZO_PELO_VENCIMENTO.includes(arquivo.tipo)) {
    const base = arquivo.validadeTexto ?? arquivo.dataCurso;
    arquivo = { ...arquivo, dataCurso: base ?? null, validadeTexto: null };
  }

  let vencimento: string | null = null;
  if (arquivo.validadePropria) {
    vencimento = arquivo.validadePropria;
  } else if (TIPOS_COM_VALIDADE_PROPRIA.includes(arquivo.tipo)) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Validade não cadastrada' };
  } else if (prazo === 0) {
    // A pessoa tem e o documento não vence (formação, cursos de BA-CE/BA-MC, CTPS...): está em dia.
    return { ...base, situacao: 'emdia', vencimento: null, texto: 'Não vence' };
  } else if ((prazo === null || prazo === undefined) && arquivo.validadeTexto) {
    vencimento = arquivo.validadeTexto; // validade escrita no próprio documento
  } else if ((prazo === null || prazo === undefined) && arquivo.pastaId === PASTA_EXTRAS) {
    // Cursos extras variam de pessoa para pessoa: aparecem sem cobrar prazo.
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Curso extra' };
  } else if (prazo === null || prazo === undefined) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Prazo a definir' };
  } else if (!arquivo.dataCurso) {
    const texto = arquivo.formato === 'pdf' && arquivo.dataLida === false ? 'Lendo a data…'
      : arquivo.dataLida ? 'Data não encontrada no PDF' : 'Falta a data do curso';
    return { ...base, situacao: 'neutro', vencimento: null, texto };
  } else {
    vencimento = somarMeses(arquivo.dataCurso, prazo);
  }

  const dias = diasAte(vencimento, hojeISO);
  if (dias < 0) {
    const ha = -dias;
    return { ...base, situacao: 'vencido', vencimento, texto: `Venceu em ${br(vencimento)} · há ${ha} dia${ha === 1 ? '' : 's'}` };
  }
  if (somarMeses(hojeISO, MESES_AVISO_POR_PASTA[arquivo.pastaId] ?? MESES_AVISO_PADRAO) >= vencimento) {
    return { ...base, situacao: 'vence', vencimento, texto: `Vence em ${br(vencimento)} · faltam ${dias} dia${dias === 1 ? '' : 's'}` };
  }
  return { ...base, situacao: 'emdia', vencimento, texto: `Vence em ${br(vencimento)}` };
}

/** Qual arquivo vale quando há mais de um do mesmo documento: o que está melhor. */
const MELHOR: Record<SituacaoDocumento, number> = { emdia: 4, vence: 3, neutro: 2, vencido: 1, falta: 0 };

/** Documentos da pessoa por pasta, incluindo os obrigatórios que não estão na pasta ("Falta"). */
/**
 * Documento que a pessoa NÃO é obrigada a ter: se ela tem, fica verde (mesmo vencido, com o aviso no texto);
 * se não tem, fica cinza "Não tem · não obrigatório". Nunca vermelho nem amarelo.
 */
function suavizarSeNaoObrigatorio(doc: DocumentoAvaliado, obrigatorio: boolean): DocumentoAvaliado {
  if (obrigatorio) return doc;
  if (doc.situacao === 'falta') return { ...doc, situacao: 'neutro', texto: 'Não tem · não obrigatório' };
  const texto = doc.situacao === 'vencido' || doc.situacao === 'vence' ? `${doc.texto} · não obrigatório` : doc.texto;
  return { ...doc, situacao: 'emdia', texto };
}

export function avaliarPessoa(arquivos: ArquivoDrive[], config: ConfigDocumentos, hojeISO: string, cargo?: string | null) {
  const porPasta = new Map<string, DocumentoAvaliado[]>();
  for (const pasta of PASTAS_DRIVE) porPasta.set(pasta.id, []);
  const grupos = new Map<string, ArquivoDrive[]>();
  for (const arquivo of arquivos) {
    if (arquivoIgnorado(arquivo.nomeArquivo)) continue;
    const chave = `${arquivo.pastaId}|${arquivo.tipo}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), arquivo]);
  }
  for (const doGrupo of grupos.values()) {
    const avaliados = doGrupo.map(a => avaliarArquivo(a, config, hojeISO));
    const melhor = avaliados.reduce((a, b) => (MELHOR[b.situacao] > MELHOR[a.situacao]
      || (MELHOR[b.situacao] === MELHOR[a.situacao] && (b.vencimento ?? '') > (a.vencimento ?? '')) ? b : a));
    porPasta.get(melhor.pastaId)?.push(suavizarSeNaoObrigatorio({ ...melhor, arquivos: doGrupo }, obrigatorioPara(melhor.tipo, cargo, config)));
  }

  const tipos = new Set(arquivos.map(a => a.tipo));
  for (const tipo of config.obrigatorios) {
    if (tipos.has(tipo) || !obrigatorioPara(tipo, cargo, config)) continue;
    const pastaId = config.adicionados?.find(a => a.tipo === tipo)?.pastaId ?? PASTA_PADRAO[tipo] ?? '04';
    porPasta.get(pastaId)?.push({ arquivo: null, arquivos: [], tipo, pastaId, situacao: 'falta', vencimento: null, texto: 'Não está na pasta' });
  }

  const contagem: Record<SituacaoDocumento, number> = { vencido: 0, vence: 0, emdia: 0, neutro: 0, falta: 0 };
  for (const docs of porPasta.values()) for (const d of docs) contagem[d.situacao]++;
  const pior: SituacaoDocumento = contagem.vencido || contagem.falta
    ? 'vencido'
    : contagem.vence ? 'vence' : contagem.emdia ? 'emdia' : 'neutro';
  return { porPasta, contagem, pior };
}

/* ───────── Catálogo (nomes de documentos, sem dados de pessoas) ───────── */

const CATALOGO: Array<{ pastaId: string; arquivo: string; chance?: number }> = [
  { pastaId: '01', arquivo: '01 - FORMAÇÃO.pdf' },
  { pastaId: '01', arquivo: '02 - CAP BA + CBA AT.pdf' },
  { pastaId: '01', arquivo: '03 - CURSO BACE.pdf', chance: 0.35 },
  { pastaId: '01', arquivo: '04 - CURSO BAMC.pdf', chance: 0.45 },
  { pastaId: '01', arquivo: '04B - CURSO BAMC.pdf', chance: 0.25 },
  { pastaId: '01', arquivo: '05 - CNH.pdf' },
  { pastaId: '01', arquivo: '06 - CVE.pdf' },
  { pastaId: '01', arquivo: '07 - X6.txt', chance: 0.3 },
  { pastaId: '01', arquivo: '08 - PS.pdf' },
  { pastaId: '01', arquivo: 'desktop.ini' },
  { pastaId: '02', arquivo: '01 - APAM.pdf' },
  { pastaId: '02', arquivo: '02 - AVSEC.pdf' },
  { pastaId: '02', arquivo: '03 - COMPLIANCE.pdf' },
  { pastaId: '02', arquivo: '04 - CVA.pdf' },
  { pastaId: '02', arquivo: '05 - SGSO.pdf' },
  { pastaId: '02', arquivo: '06 - RISCO FAUNA.pdf' },
  { pastaId: '02', arquivo: '07 - INTEGRAÇÃO.pdf' },
  { pastaId: '03', arquivo: '01 - NR01.pdf' },
  { pastaId: '03', arquivo: '02 - NR05.pdf' },
  { pastaId: '03', arquivo: '03 - NR06.pdf' },
  { pastaId: '03', arquivo: '04 - NR10 NAVEGANTES.pdf' },
  { pastaId: '03', arquivo: '05 - NR12.pdf' },
  { pastaId: '03', arquivo: '06 - NR18.pdf' },
  { pastaId: '03', arquivo: '07 - NR20.pdf' },
  { pastaId: '03', arquivo: '08 - NR23.pdf' },
  { pastaId: '03', arquivo: '09 - NR26.pdf' },
  { pastaId: '03', arquivo: '10 - NR33.pdf' },
  { pastaId: '03', arquivo: '11 - NR35.pdf' },
  { pastaId: '04', arquivo: '01 - OPERADOR DE EMPILHADEIRA.pdf' },
  { pastaId: '05', arquivo: '01 - FICHA CADASTRAL.pdf' },
  { pastaId: '05', arquivo: '02 - CTPS.pdf' },
  { pastaId: '05', arquivo: '03 - ASO.pdf' },
  { pastaId: '05', arquivo: '04 - COMPROVANTE DE RESIDÊNCIA.jpg' },
  { pastaId: '05', arquivo: '05 - ESCOLARIDADE.pdf' },
  { pastaId: '05', arquivo: '06 - FICHA EPI.pdf' },
  { pastaId: '06', arquivo: '01 - CREDENCIAL AEROPORTUÁRIA.jpg' },
  { pastaId: '06', arquivo: '02 - ANTECEDENTES CRIMINAIS.pdf' },
];

/** Em que pasta o documento costuma ficar (para mostrar o "Falta" no bloco certo). */
const PASTA_PADRAO: Record<string, string> = Object.fromEntries(
  CATALOGO.map(c => [tipoPeloNome(c.arquivo), c.pastaId]),
);

/** Prazos de EXEMPLO para ver as cores. O administrador ajusta na aba "Validade dos documentos". */
export const CONFIG_EXEMPLO: ConfigDocumentos = {
  prazos: {
    'FORMAÇÃO': 0, 'CAP BA + CBA AT': 24, 'CHEFE DE EQUIPE (BA-CE)': 0, 'MOTORISTA CONDUTOR (BA-MC)': 0,
    CNH: null, CVE: 60, X6: null, 'PRIMEIROS SOCORROS': 24,
    APAM: 24, AVSEC: 24, COMPLIANCE: 12, CVA: 24, SGSO: 24, 'RISCO FAUNA': 24, 'INTEGRAÇÃO': 12,
    'NR 01': 24, 'NR 05': 12, 'NR 06': 12, 'NR 10': 24, 'NR 12': 24, 'NR 18': 24, 'NR 20': 12,
    'NR 23': 12, 'NR 26': 24, 'NR 33': 12, 'NR 35': 24,
    'OPERADOR DE EMPILHADEIRA': null,
    'FICHA CADASTRAL': 0, CTPS: 0, ASO: 12, 'COMPROVANTE DE RESIDÊNCIA': 12, ESCOLARIDADE: 0, 'FICHA EPI': 0,
    'ANTECEDENTES CRIMINAIS': 6,
  },
  obrigatorios: ['CNH', 'CVE', 'APAM', 'AVSEC', 'NR 10', 'NR 35', 'ASO', 'CREDENCIAL AEROPORTUÁRIA'],
};

/* ───────── Dados de exemplo ───────── */

function semente(texto: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Arquivos de exemplo da pessoa (sempre os mesmos para a mesma pessoa). */
export function documentosExemplo(pessoaId: string, hojeISO: string): ArquivoDrive[] {
  const sorte = semente(pessoaId);
  const arquivos: ArquivoDrive[] = [];
  for (const item of CATALOGO) {
    if (sorte() > (item.chance ?? 0.88)) continue; // às vezes o documento não está na pasta
    const tipo = tipoPeloNome(item.arquivo);
    const mesesAtras = Math.floor(sorte() * 30); // curso feito entre hoje e 30 meses atrás
    const dataCurso = sorte() < 0.08 ? null : somarMeses(hojeISO, -mesesAtras);
    arquivos.push({
      id: `${pessoaId}-${item.pastaId}-${tipo}`,
      pastaId: item.pastaId,
      nomeArquivo: item.arquivo,
      tipo,
      formato: /\.(jpe?g|png)$/i.test(item.arquivo) ? 'imagem' : /\.pdf$/i.test(item.arquivo) ? 'pdf' : 'outro',
      dataCurso,
    });
  }
  return arquivos;
}

/** Todos os tipos encontrados (para a aba de validade). */
export function tiposEncontrados(): Array<{ tipo: string; pastaId: string }> {
  const vistos = new Map<string, string>();
  for (const c of CATALOGO) {
    if (arquivoIgnorado(c.arquivo)) continue;
    const tipo = tipoPeloNome(c.arquivo);
    if (!vistos.has(tipo)) vistos.set(tipo, c.pastaId);
  }
  return [...vistos].map(([tipo, pastaId]) => ({ tipo, pastaId }));
}

/* ───────── Configuração salva (só neste navegador enquanto for exemplo) ───────── */

const CHAVE_CONFIG = 'certificacoes.drive.config.v2';

/** Completa uma configuração salva (navegador ou banco) com o que foi criado depois. null = inválida. */
export function completarConfig(valor: unknown): ConfigDocumentos | null {
  const c = valor as ConfigDocumentos | null;
  if (!c || typeof c.prazos !== 'object' || !Array.isArray(c.obrigatorios)) return null;
  const semCargos = !c.cargosObrigatorio;
  return {
    ...c, padroes: c.padroes ?? PADROES_INICIAIS, apelidos: c.apelidos ?? {},
    cargosObrigatorio: c.cargosObrigatorio ?? CARGOS_OBRIGATORIO_INICIAIS,
    // configuração salva antes dos cargos: entra com os obrigatórios por cargo combinados
    obrigatorios: semCargos
      ? [...new Set([...c.obrigatorios, ...Object.keys(CARGOS_OBRIGATORIO_INICIAIS)])]
      : c.obrigatorios,
  };
}

/** Configuração guardada neste navegador (cópia; a que vale é a do banco). */
export function lerConfigLocal(): ConfigDocumentos | null {
  try {
    const salvo = localStorage.getItem(CHAVE_CONFIG);
    return salvo ? completarConfig(JSON.parse(salvo)) : null;
  } catch {
    return null;
  }
}

export function lerConfig(): ConfigDocumentos {
  const local = lerConfigLocal();
  if (local) return local;
  return {
    ...CONFIG_EXEMPLO,
    obrigatorios: [...new Set([...CONFIG_EXEMPLO.obrigatorios, ...Object.keys(CARGOS_OBRIGATORIO_INICIAIS)])],
    padroes: PADROES_INICIAIS, apelidos: {}, cargosObrigatorio: CARGOS_OBRIGATORIO_INICIAIS,
  };
}

export function salvarConfig(config: ConfigDocumentos) {
  try { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config)); } catch { /* ignora */ }
}
