import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthUser, isAdmin } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { acharDatas } from './datas-pdf';
import { DriveApiService, ItemDrive, PASTA_MIME } from './drive-api.service';

// pdf-parse 2 (CommonJS): só o texto das primeiras páginas do certificado.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as { PDFParse: new (o: { data: Buffer }) => { getText(o?: { first?: number }): Promise<{ text: string }>; destroy(): Promise<void> } };

interface LinhaData {
  arquivo_id: string;
  modificado: string | null;
  data_curso: string | null;
  validade: string | null;
  origem: string | null;
  data_informada: string | null;
}

const PASTAS_COM_DATA_SOLTA = new Set(['01', '02', '03', '04', '06']);
const LEITURAS_AO_MESMO_TEMPO = 4;
const TAMANHO_MAXIMO_PDF_DATA = 15 * 1024 * 1024;

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};

/**
 * Lê a pasta principal do Drive ("Controle Documentos"): cada pessoa tem uma pasta com as subpastas
 * numeradas (01 - Documentação Técnica … 06 - Credenciamento). Pastas que só agrupam pessoas
 * (ex.: afastados) também são percorridas. A pasta é ligada à pessoa do cadastro pelo nome.
 */
export interface ArquivoPessoa {
  id: string;
  nome: string;
  /** "01" … "06": a subpasta numerada onde o arquivo está. */
  pasta: string;
  /** Subpastas abaixo da numerada (ex.: ["INSTITUCIONAIS"]). */
  caminho: string[];
  mime: string;
  tamanho: number;
  modificado: string | null;
}

interface PastaPessoa {
  pastaId: string;
  nomePasta: string;
  arquivos: ArquivoPessoa[];
}

interface Leitura {
  em: number;
  pessoas: PastaPessoa[];
  /** id do arquivo → id da pasta da pessoa (para conferir antes de abrir). */
  donoDoArquivo: Map<string, string>;
}

interface Bombeiro {
  id: string;
  nome_completo: string | null;
  equipe: string | null;
  cargo: string | null;
}

const VALIDADE_LEITURA_MS = 5 * 60 * 1000;
const SUBPASTA_NUMERADA = /^\s*0?([1-9])\s*-/;
const PROFUNDIDADE_MAXIMA = 7;
const TAMANHO_MAXIMO = 30 * 1024 * 1024;

/** "C - ALINE FABIANA LIMA" / "D - FULANO - INSS" → "ALINE FABIANA LIMA" / "FULANO" (sem acento). */
export function nomeDaPasta(nome: string): string {
  return normalizar(nome.replace(/^\s*(GS|BA-[A-Z]{2}|[A-Z]{1,2})\s*-\s*/i, '').replace(/\s+-\s+.*$/, ''));
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

/** Distância entre duas palavras (letras trocadas, faltando ou sobrando). */
function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/** Mesma palavra, aceitando erro de digitação pequeno em nomes compridos (PALLEN ≈ PALEM). */
function palavraParecida(a: string, b: string): boolean {
  if (a === b) return true;
  const menor = Math.min(a.length, b.length);
  return menor >= 5 && distancia(a, b) <= 2;
}
const palavras = (nome: string) => normalizar(nome).split(' ').filter(p => p.length > 1 && !PARTICULAS.has(p));

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private leitura: Leitura | null = null;
  private lendo: Promise<Leitura> | null = null;
  private datas = new Map<string, LinhaData>();
  private datasCarregadas = false;
  private lendoDatas = false;
  private progresso = { total: 0, feitos: 0 };

  constructor(
    private readonly api: DriveApiService,
    private readonly database: DatabaseService,
  ) {}

  /* ───────── Quem pode ver ───────── */

  /** Igual à tela de Certificações: administrador e GS veem tudo; BA-CE e BA-LR só a própria equipe. */
  private async escopo(user: AuthUser | undefined): Promise<{ todas: boolean; equipe: string | null }> {
    if (!user) throw new ForbiddenException('Sem acesso aos documentos.');
    if (isAdmin(user)) return { todas: true, equipe: null };
    const r = await this.database.query<{ cargo: string | null; equipe: string | null }>(
      `SELECT b.cargo, b.equipe FROM usuarios u JOIN bombeiros b ON b.id::text = u.person_id::text
        WHERE u.id = $1 AND u.person_type = 'bombeiro' LIMIT 1`,
      [user.id],
    );
    const pessoa = r.rows[0];
    if (pessoa?.cargo === 'GS') return { todas: true, equipe: null };
    if (pessoa && (pessoa.cargo === 'BA-CE' || pessoa.cargo === 'BA-LR') && pessoa.equipe) {
      return { todas: false, equipe: pessoa.equipe };
    }
    throw new ForbiddenException('Somente Administradores, GS, BA-CE e BA-LR podem ver os documentos.');
  }

  /* ───────── Leitura do Drive ───────── */

  private async ler(forcar: boolean): Promise<Leitura> {
    if (!forcar && this.leitura && Date.now() - this.leitura.em < VALIDADE_LEITURA_MS) return this.leitura;
    if (this.lendo) return this.lendo;
    this.lendo = this.percorrer().finally(() => { this.lendo = null; });
    this.leitura = await this.lendo;
    void this.lerDatasEmSegundoPlano(this.leitura);
    return this.leitura;
  }

  /* ───────── Datas dos PDFs (lidas uma vez e guardadas; lê de novo se o arquivo mudar) ───────── */

  private async carregarDatas() {
    if (this.datasCarregadas) return;
    const r = await this.database.query<LinhaData>(
      'SELECT arquivo_id, modificado, data_curso, validade, origem, data_informada FROM drive_datas',
    );
    this.datas = new Map(r.rows.map(l => [l.arquivo_id, {
      ...l, modificado: l.modificado ? new Date(l.modificado).toISOString() : null,
      data_curso: iso(l.data_curso), validade: iso(l.validade), data_informada: iso(l.data_informada),
    }]));
    this.datasCarregadas = true;
  }

  private async lerDatasEmSegundoPlano(leitura: Leitura) {
    if (this.lendoDatas) return;
    this.lendoDatas = true;
    try {
      await this.carregarDatas();
      const pendentes = leitura.pessoas.flatMap(p => p.arquivos).filter(a => {
        if (!a.mime.includes('pdf') || a.tamanho > TAMANHO_MAXIMO_PDF_DATA) return false;
        const lido = this.datas.get(a.id);
        return !lido || (a.modificado && lido.modificado !== new Date(a.modificado).toISOString());
      });
      this.progresso = { total: pendentes.length, feitos: 0 };
      const hoje = iso(new Date())!;
      let proximo = 0;
      const trabalhar = async () => {
        while (proximo < pendentes.length) {
          const arquivo = pendentes[proximo++];
          await this.lerDataDoArquivo(arquivo, hoje);
          this.progresso.feitos++;
        }
      };
      await Promise.all(Array.from({ length: LEITURAS_AO_MESMO_TEMPO }, trabalhar));
    } catch (erro) {
      this.logger.error(`Leitura das datas parou: ${(erro as Error).message}`);
    } finally {
      this.lendoDatas = false;
    }
  }

  private async lerDataDoArquivo(arquivo: ArquivoPessoa, hoje: string) {
    let achado: { dataCurso: string | null; validade: string | null; origem: string | null } = { dataCurso: null, validade: null, origem: null };
    let erro: string | null = null;
    try {
      const { dados } = await this.api.baixar(arquivo.id);
      const parser = new PDFParse({ data: dados });
      try {
        const { text } = await parser.getText({ first: 3 });
        achado = acharDatas(text, hoje, PASTAS_COM_DATA_SOLTA.has(arquivo.pasta));
        if (!text.trim()) erro = 'PDF sem texto (imagem)';
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (e) {
      erro = (e as Error).message.slice(0, 200);
    }
    const modificado = arquivo.modificado ? new Date(arquivo.modificado).toISOString() : null;
    await this.database.query(
      `INSERT INTO drive_datas (arquivo_id, modificado, data_curso, validade, origem, erro, lido_em)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (arquivo_id) DO UPDATE SET modificado = EXCLUDED.modificado, data_curso = EXCLUDED.data_curso,
         validade = EXCLUDED.validade, origem = EXCLUDED.origem, erro = EXCLUDED.erro, lido_em = now()`,
      [arquivo.id, modificado, achado.dataCurso, achado.validade, achado.origem, erro],
    );
    const anterior = this.datas.get(arquivo.id);
    this.datas.set(arquivo.id, {
      arquivo_id: arquivo.id, modificado, data_curso: achado.dataCurso, validade: achado.validade,
      origem: achado.origem, data_informada: anterior?.data_informada ?? null,
    });
  }

  /* ───────── Configuração da aba "Validade dos documentos" (uma só para todos) ───────── */

  async lerConfig(user: AuthUser | undefined) {
    await this.escopo(user);
    const r = await this.database.query<{ config: unknown; atualizado_em: string; atualizado_por: string | null }>(
      'SELECT config, atualizado_em, atualizado_por FROM drive_config WHERE id = 1',
    );
    const linha = r.rows[0];
    return linha
      ? { config: linha.config, atualizadoEm: linha.atualizado_em, atualizadoPor: linha.atualizado_por }
      : { config: null, atualizadoEm: null, atualizadoPor: null };
  }

  async salvarConfig(user: AuthUser | undefined, config: unknown) {
    if (!isAdmin(user)) throw new ForbiddenException('Somente administradores alteram a validade dos documentos.');
    const c = config as Record<string, unknown> | null;
    if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.prazos !== 'object' || !Array.isArray(c.obrigatorios)) {
      throw new BadRequestException('Configuração inválida.');
    }
    const texto = JSON.stringify(c);
    if (texto.length > 500_000) throw new BadRequestException('Configuração grande demais.');
    await this.database.query(
      `INSERT INTO drive_config (id, config, atualizado_em, atualizado_por) VALUES (1, $1::jsonb, now(), $2)
       ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por`,
      [texto, user?.username ?? null],
    );
    return { ok: true };
  }

  /** Data digitada por alguém (PDF sem texto ou data errada). null apaga. */
  async informarData(user: AuthUser | undefined, arquivoId: string, data: string | null) {
    const escopo = await this.escopo(user);
    if (!escopo.todas) throw new ForbiddenException('Somente Administradores e GS podem informar a data.');
    if (data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new BadRequestException('Data inválida.');
    const leitura = await this.ler(false);
    if (!leitura.donoDoArquivo.has(arquivoId)) throw new NotFoundException('Arquivo não encontrado na pasta de documentos.');
    await this.carregarDatas();
    await this.database.query(
      `INSERT INTO drive_datas (arquivo_id, data_informada, informada_por) VALUES ($1, $2, $3)
       ON CONFLICT (arquivo_id) DO UPDATE SET data_informada = EXCLUDED.data_informada, informada_por = EXCLUDED.informada_por`,
      [arquivoId, data, user?.username ?? null],
    );
    const atual = this.datas.get(arquivoId);
    this.datas.set(arquivoId, {
      arquivo_id: arquivoId, modificado: atual?.modificado ?? null, data_curso: atual?.data_curso ?? null,
      validade: atual?.validade ?? null, origem: atual?.origem ?? null, data_informada: data,
    });
    return { ok: true };
  }

  private async percorrer(): Promise<Leitura> {
    const raiz = this.api.pastaRaiz!;
    const filhos = new Map<string, ItemDrive[]>();
    let fronteira = [raiz];
    for (let nivel = 0; nivel < PROFUNDIDADE_MAXIMA && fronteira.length; nivel++) {
      const itens = await this.api.filhosDe(fronteira);
      const proxima: string[] = [];
      for (const item of itens) {
        for (const pai of item.parents ?? []) {
          if (!fronteira.includes(pai)) continue;
          filhos.set(pai, [...(filhos.get(pai) ?? []), item]);
        }
        if (item.mimeType === PASTA_MIME) proxima.push(item.id);
      }
      fronteira = proxima;
    }

    const ehPessoa = (pastaId: string) =>
      (filhos.get(pastaId) ?? []).filter(f => f.mimeType === PASTA_MIME && SUBPASTA_NUMERADA.test(f.name)).length >= 2;

    const pessoas: PastaPessoa[] = [];
    const donoDoArquivo = new Map<string, string>();
    const visitar = (pastaId: string, profundidade: number) => {
      for (const item of filhos.get(pastaId) ?? []) {
        if (item.mimeType !== PASTA_MIME || profundidade > 3) continue;
        if (/^\s*[A-Z]{0,2}\s*-?\s*(padr[aã]o|modelo)\s*$/i.test(item.name)) continue; // pasta modelo
        if (ehPessoa(item.id)) pessoas.push(this.montarPessoa(item, filhos, donoDoArquivo));
        else visitar(item.id, profundidade + 1); // pasta que só agrupa pessoas
      }
    };
    visitar(raiz, 0);
    return { em: Date.now(), pessoas, donoDoArquivo };
  }

  private montarPessoa(pasta: ItemDrive, filhos: Map<string, ItemDrive[]>, donoDoArquivo: Map<string, string>): PastaPessoa {
    const arquivos: ArquivoPessoa[] = [];
    const descer = (pastaId: string, numero: string, caminho: string[]) => {
      for (const item of filhos.get(pastaId) ?? []) {
        if (item.mimeType === PASTA_MIME) {
          descer(item.id, numero, [...caminho, item.name.trim()]);
          continue;
        }
        if (item.mimeType.startsWith('application/vnd.google-apps.')) continue; // atalhos, Docs: sem arquivo
        arquivos.push({
          id: item.id, nome: item.name.trim(), pasta: numero, caminho, mime: item.mimeType,
          tamanho: Number(item.size ?? 0), modificado: item.modifiedTime ?? null,
        });
        donoDoArquivo.set(item.id, pasta.id);
      }
    };
    for (const sub of filhos.get(pasta.id) ?? []) {
      const numero = sub.mimeType === PASTA_MIME ? sub.name.match(SUBPASTA_NUMERADA)?.[1] : null;
      if (numero) descer(sub.id, numero.padStart(2, '0'), []);
    }
    return { pastaId: pasta.id, nomePasta: pasta.name.trim(), arquivos };
  }

  /* ───────── Pasta ↔ pessoa do cadastro ───────── */

  private async vincular(pessoas: PastaPessoa[]) {
    const r = await this.database.query<Bombeiro>('SELECT id, nome_completo, equipe, cargo FROM bombeiros');
    const bombeiros = r.rows.filter(b => b.nome_completo);
    const porNome = new Map(bombeiros.map(b => [normalizar(b.nome_completo!), b]));
    const usados = new Set<string>();
    const ligados: Array<{ pessoa: PastaPessoa; bombeiro: Bombeiro }> = [];
    const soltos: PastaPessoa[] = [];

    for (const pessoa of pessoas) {
      const nome = nomeDaPasta(pessoa.nomePasta);
      let achado = porNome.get(nome);
      if (!achado) {
        // Sem o nome idêntico: todas as palavras da pasta precisam estar no nome do cadastro (ou o contrário).
        const daPasta = palavras(nome);
        const candidatos = bombeiros.filter(b => {
          const doCadastro = palavras(b.nome_completo!);
          const menor = daPasta.length <= doCadastro.length ? daPasta : doCadastro;
          const maior = menor === daPasta ? doCadastro : daPasta;
          return menor.length >= 2 && menor.every(p => maior.some(m => palavraParecida(p, m)));
        });
        if (candidatos.length === 1) achado = candidatos[0];
      }
      if (!achado) {
        // "GS - GUSTAVO": cargo na frente e só o primeiro nome
        const cargo = pessoa.nomePasta.match(/^\s*(GS|BA-CE|BA-LR)\s*-/i)?.[1]?.toUpperCase();
        const primeiro = palavras(nome)[0];
        if (cargo && primeiro) {
          const doCargo = bombeiros.filter(b => b.cargo === cargo && palavras(b.nome_completo!)[0] === primeiro);
          if (doCargo.length === 1) achado = doCargo[0];
        }
      }
      if (achado && !usados.has(achado.id)) {
        usados.add(achado.id);
        ligados.push({ pessoa, bombeiro: achado });
      } else {
        soltos.push(pessoa);
      }
    }
    return { ligados, soltos };
  }

  /* ───────── Rotas ───────── */

  async documentos(user: AuthUser | undefined, atualizar: boolean) {
    const escopo = await this.escopo(user);
    if (!this.api.configurado) return { configurado: false, pessoas: [], semVinculo: [], atualizadoEm: null };
    const leitura = await this.ler(atualizar);
    const { ligados, soltos } = await this.vincular(leitura.pessoas);
    const visiveis = ligados.filter(l => escopo.todas || l.bombeiro.equipe === escopo.equipe);
    await this.carregarDatas();
    const comDatas = (arquivos: ArquivoPessoa[]) => arquivos.map(a => {
      const d = this.datas.get(a.id);
      return {
        ...a,
        dataCurso: d?.data_informada ?? d?.data_curso ?? null,
        validadeTexto: d?.validade ?? null,
        origemData: d?.data_informada ? 'informada' : d?.origem ?? null,
        dataLida: !!d,
      };
    });
    return {
      configurado: true,
      atualizadoEm: new Date(leitura.em).toISOString(),
      leituraDatas: { lendo: this.lendoDatas, total: this.progresso.total, feitos: this.progresso.feitos },
      pessoas: visiveis.map(l => ({ bombeiroId: l.bombeiro.id, pasta: l.pessoa.nomePasta, arquivos: comDatas(l.pessoa.arquivos) })),
      // Pastas que o sistema não conseguiu ligar a ninguém: só quem vê todas as equipes.
      semVinculo: escopo.todas ? soltos.map(s => ({ pasta: s.nomePasta, arquivos: s.arquivos.length })) : [],
    };
  }

  async arquivo(user: AuthUser | undefined, id: string) {
    const escopo = await this.escopo(user);
    if (!this.api.configurado) throw new NotFoundException('Google Drive não configurado.');
    const leitura = await this.ler(false);
    const pastaDona = leitura.donoDoArquivo.get(id);
    if (!pastaDona) throw new NotFoundException('Arquivo não encontrado na pasta de documentos.');
    if (!escopo.todas) {
      const { ligados } = await this.vincular(leitura.pessoas);
      const dono = ligados.find(l => l.pessoa.pastaId === pastaDona);
      if (!dono || dono.bombeiro.equipe !== escopo.equipe) throw new ForbiddenException('Documento de outra equipe.');
    }
    const info = leitura.pessoas.find(p => p.pastaId === pastaDona)?.arquivos.find(a => a.id === id);
    if (info && info.tamanho > TAMANHO_MAXIMO) throw new ForbiddenException('Arquivo grande demais para visualizar.');
    return this.api.baixar(id);
  }
}
