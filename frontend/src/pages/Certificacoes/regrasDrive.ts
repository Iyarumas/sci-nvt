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
  /** Tipo do documento, tirado do nome do arquivo (ex.: "NR 35"). */
  tipo: string;
  formato: 'pdf' | 'imagem' | 'outro';
  /** Data do curso/emissão (lida do PDF ou informada no card). */
  dataCurso: string | null;
  /** Validade escrita no próprio documento (ex.: CNH). Tem prioridade sobre o prazo em meses. */
  validadePropria?: string | null;
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
  const nr = nome.match(/\bNR\s*-?\s*(\d{1,2})\b/i);
  if (nr) return `NR ${nr[1].padStart(2, '0')}`;
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
  const prazo = config.prazos[arquivo.tipo];

  let vencimento: string | null = null;
  if (arquivo.validadePropria) {
    vencimento = arquivo.validadePropria;
  } else if (TIPOS_COM_VALIDADE_PROPRIA.includes(arquivo.tipo)) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Validade não cadastrada' };
  } else if (prazo === 0) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Não vence' };
  } else if ((prazo === null || prazo === undefined) && arquivo.pastaId === PASTA_EXTRAS) {
    // Cursos extras variam de pessoa para pessoa: aparecem sem cobrar prazo.
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Curso extra' };
  } else if (prazo === null || prazo === undefined) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Prazo a definir' };
  } else if (!arquivo.dataCurso) {
    return { ...base, situacao: 'neutro', vencimento: null, texto: 'Falta a data do curso' };
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
export function avaliarPessoa(arquivos: ArquivoDrive[], config: ConfigDocumentos, hojeISO: string) {
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
    porPasta.get(melhor.pastaId)?.push({ ...melhor, arquivos: doGrupo });
  }

  const tipos = new Set(arquivos.map(a => a.tipo));
  for (const tipo of config.obrigatorios) {
    if (tipos.has(tipo)) continue;
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
    'FICHA CADASTRAL': 0, CTPS: 0, ASO: 12, 'COMPROVANTE DE RESIDÊNCIA': 0, ESCOLARIDADE: 0, 'FICHA EPI': 0,
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

export function lerConfig(): ConfigDocumentos {
  try {
    const salvo = localStorage.getItem(CHAVE_CONFIG);
    if (salvo) {
      const c = JSON.parse(salvo) as ConfigDocumentos;
      if (c && typeof c.prazos === 'object' && Array.isArray(c.obrigatorios)) return c;
    }
  } catch { /* sem armazenamento: usa o exemplo */ }
  return CONFIG_EXEMPLO;
}

export function salvarConfig(config: ConfigDocumentos) {
  try { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config)); } catch { /* ignora */ }
}
