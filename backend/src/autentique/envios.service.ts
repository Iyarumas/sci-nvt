import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { QueryResult, QueryResultRow } from 'pg';
import { AuthUser, isAdmin } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { AutentiqueApiService, SignatarioAutentique } from './autentique-api.service';
import { posicaoNaLinhaLro, validarLinhasLro } from './posicoes-lro';
import { linhasDaTabela, posicoesDaPessoa } from './posicoes-ptrba';
import { PAPEIS_TROCA, posicoesTroca } from './posicoes-troca';
import { posicaoTpepr } from './posicoes-tpepr';
import { VAGAS_TAF, posicaoLinhaTaf, posicaoRodapeTaf } from './posicoes-taf';
import { posicaoEquipagem, posicaoMotorista, posicaoRodapePosicionamento } from './posicoes-posicionamento';

export const TIPOS_ENVIO = new Set(['ptrba', 'lro', 'troca', 'tpepr', 'taf', 'posicionamento']);

/** Tabela, nome e regras de cada tipo de documento enviado para assinatura. */
const DOCUMENTOS: Record<string, { tabela: string; nome: string; pasta: string; criador: string }> = {
  ptrba: { tabela: 'ptrba_completo_registros', nome: 'PTR-BA', pasta: 'PTRBA', criador: 'created_by' },
  lro: { tabela: 'lro_drafts', nome: 'LRO', pasta: 'LRO', criador: 'created_by' },
  troca: { tabela: 'document_fills', nome: 'troca', pasta: 'TROCAS', criador: 'filled_by' },
  tpepr: { tabela: 'treinamentos_tpepr', nome: 'TP/EPR', pasta: 'TP EPR', criador: 'created_by' },
  taf: { tabela: 'treinamentos_taf', nome: 'TAF', pasta: 'TAF', criador: 'created_by' },
  posicionamento: { tabela: 'exercicios_posicionamento', nome: 'Exercício de Posicionamento', pasta: 'POSICIONAMENTO', criador: 'created_by' },
};

/** Exercício de Posicionamento antes deste dia segue o fluxo antigo. */
export const INICIO_ASSINATURA_POSICIONAMENTO = '2026-11-08';

/** Viaturas do Posicionamento: coluna do BA-MC e da equipagem, na ordem em que o PDF desenha. */
const VIATURAS_POSICIONAMENTO = [
  { motorista: 'faisca2_ba_mc', equipagem: ['faisca2_ba_ce', 'faisca2_ba2'] },
  { motorista: 'faisca3_ba_mc', equipagem: ['faisca3_ba2_1', 'faisca3_ba2_2'] },
  { motorista: 'crs_ba_mc', equipagem: ['crs_ba_lr', 'crs_ba_re1', 'crs_ba_re2'] },
];

/** TAF com treinamento antes deste dia seguem o fluxo antigo (Aprovar manual). */
export const INICIO_ASSINATURA_TAF = '2026-11-08';

/** TP/EPR com treinamento antes deste dia seguem o fluxo antigo (Aprovar manual). */
export const INICIO_ASSINATURA_TPEPR = '2026-11-08';

/** TP/EPR: os participantes que não são chefe nem gerente só reconhecem o documento. */
export const FUNCAO_RECONHECIMENTO = 'Reconhecimento';

/** LRO com plantão antes deste dia seguem o fluxo antigo (Finalizar manual). */
export const INICIO_ASSINATURA_LRO = '2026-11-06';

/** Situacoes do PTR-BA que nao assinam (ausente). */
const SITUACOES_SEM_ASSINATURA = new Set(['A']);

/** Papeis que podem enviar, reenviar e ver os links de assinatura. */
const PAPEIS_GESTAO = new Set(['gerente', 'chefe', 'lider']);

/** PTR-BA com plantão antes deste dia foram assinados fora do sistema e não são enviados por aqui. */
export const INICIO_ASSINATURA_PTRBA = '2026-11-06';

/**
 * Quem não segura o documento:
 * - PTR-BA: está assinado quando todos os BA assinaram; APOC raramente assina, então não segura
 *   (se assinar depois, o PDF é atualizado).
 * - TP/EPR: só o chefe e o gerente assinam; quem só reconhece nunca segura.
 */
const NAO_SEGURAM = new Set(['APOC', FUNCAO_RECONHECIMENTO.toUpperCase()]);
function naoSeguraDocumento(funcoes: string): boolean {
  const lista = String(funcoes ?? '').split(',').map(f => f.trim().toUpperCase()).filter(Boolean);
  return lista.length > 0 && lista.every(f => NAO_SEGURAM.has(f));
}

/** Onde ficam os PDFs assinados baixados do Autentique. */
const BUCKET_ASSINADOS = 'autentique-assinados';

export interface ParticipanteEnvio {
  funcao?: string;
  nomeCompleto?: string;
  situacao?: string;
}

export interface EnviarInput {
  tipo: string;
  referenciaId: string;
  participantes: ParticipanteEnvio[];
  chefeEquipe?: string;
  pdf?: Buffer;
  /** Nome do arquivo gerado no sistema (ex.: "03-11-2026 NVT PTRBA DELTA.pdf"). */
  nomeArquivo?: string;
  /** LRO: página e altura de cada linha de assinatura, medidas ao gerar o PDF. */
  linhasAssinatura?: unknown;
}

type Problema = 'sem_cadastro' | 'sem_email' | 'email_repetido';

interface SignatarioMontado {
  ordem: number;
  chave: string;
  funcoes: string[];
  nome: string;
  email: string;
  celular: string;
}

interface EnvioRow extends QueryResultRow {
  id: string;
  tipo: string;
  referencia_id: string;
  status: string;
  autentique_document_id: string;
  sandbox: boolean;
  pdf_assinado_url: string | null;
  enviado_por_id: string;
  enviado_por_nome: string;
  enviado_em: Date;
  concluido_em: Date | null;
}

interface SignatarioRow extends QueryResultRow {
  id: string;
  envio_id: string;
  ordem: number;
  funcoes: string;
  nome: string;
  email: string;
  celular: string;
  autentique_signature_id: string | null;
  link: string | null;
  status: string;
  assinado_em: Date | null;
  recusado_em: Date | null;
}

export function normalizarNome(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function dataISO(valor: unknown): string {
  if (valor instanceof Date) {
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }
  return String(valor ?? '').slice(0, 10);
}

/** Um documento com envio ativo (aguardando, assinado ou recusado) nao pode mais ser alterado. */
export async function documentosComEnvioAtivo(
  client: { query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> },
  tipo: string,
  ids: string[],
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const result = await client.query<{ referencia_id: string }>(
    `SELECT referencia_id FROM autentique_envios WHERE tipo = $1 AND status <> 'cancelado' AND referencia_id = ANY($2::uuid[])`,
    [tipo, ids],
  );
  return new Set(result.rows.map(row => row.referencia_id));
}

@Injectable()
export class EnviosService {
  private readonly logger = new Logger(EnviosService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    private readonly api: AutentiqueApiService,
    private readonly storage: LocalStorageService,
  ) {}

  /** Sem a integracao real, o modo simulado deixa testar a tela localmente. Nunca vale em producao. */
  private get modoSimulado(): boolean {
    return this.config.get<string>('AUTENTIQUE_MODO') === 'simulado' && process.env.NODE_ENV !== 'production';
  }

  private ehSimulado(envio: Pick<EnvioRow, 'autentique_document_id'>): boolean {
    return envio.autentique_document_id.startsWith('simulado-');
  }

  private podeGerir(user: AuthUser, envio?: Pick<EnvioRow, 'enviado_por_id'>): boolean {
    if (isAdmin(user) || PAPEIS_GESTAO.has(user.role)) return true;
    return !!envio && envio.enviado_por_id === user.id;
  }

  async listar(user: AuthUser, tipo: string, referencias: string[]) {
    this.validarTipo(tipo);
    // Sem referências, lista todos os envios ativos do tipo (a tela filtra por mês e equipe).
    const ids = referencias.filter(id => /^[0-9a-f-]{36}$/i.test(id));
    if (referencias.length && !ids.length) return [];
    const envios = ids.length
      ? await this.database.query<EnvioRow>(
        `SELECT * FROM autentique_envios WHERE tipo = $1 AND status <> 'cancelado' AND referencia_id = ANY($2::uuid[])`,
        [tipo, ids],
      )
      : await this.database.query<EnvioRow>(
        `SELECT * FROM autentique_envios WHERE tipo = $1 AND status <> 'cancelado'`,
        [tipo],
      );
    if (!envios.rows.length) return [];
    const signatarios = await this.database.query<SignatarioRow>(
      `SELECT * FROM autentique_signatarios WHERE envio_id = ANY($1::uuid[]) ORDER BY ordem`,
      [envios.rows.map(envio => envio.id)],
    );
    return envios.rows.map(envio => {
      const gerir = this.podeGerir(user, envio);
      return {
        id: envio.id,
        tipo: envio.tipo,
        referenciaId: envio.referencia_id,
        status: envio.status,
        enviadoPorNome: envio.enviado_por_nome,
        enviadoEm: envio.enviado_em,
        concluidoEm: envio.concluido_em,
        sandbox: envio.sandbox,
        temPdfAssinado: !!envio.pdf_assinado_url,
        podeGerir: gerir,
        signatarios: signatarios.rows
          .filter(signatario => signatario.envio_id === envio.id)
          .map(signatario => ({
            id: signatario.id,
            ordem: signatario.ordem,
            funcoes: signatario.funcoes ? signatario.funcoes.split(',') : [],
            nome: signatario.nome,
            status: signatario.status,
            assinadoEm: signatario.assinado_em,
            recusadoEm: signatario.recusado_em,
            // O celular so vai para quem pode cobrar a assinatura; o link e pedido na hora.
            celular: gerir ? signatario.celular : null,
          })),
      };
    });
  }

  private async verificarPermissaoEnvio(user: AuthUser, tipo: string, referenciaId: string) {
    if (this.podeGerir(user)) return;
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('Documento não encontrado.');
    const doc = DOCUMENTOS[tipo];
    const registro = await this.database.query<{ criador: string }>(
      `SELECT ${doc.criador} AS criador FROM ${doc.tabela} WHERE id = $1`,
      [referenciaId],
    );
    if (normalizarNome(registro.rows[0]?.criador) !== normalizarNome(user.username)) {
      throw new ForbiddenException(`Só quem criou o ${doc.nome}, a chefia ou um administrador pode enviar para assinatura.`);
    }
  }

  /** LRO: quem assina é o chefe de equipe do plantão e o gerente do SESCINC (cargo GS no cadastro). */
  private async participantesLro(referenciaId: string): Promise<ParticipanteEnvio[]> {
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('LRO não encontrado.');
    const result = await this.database.query<{ dados: Record<string, unknown> | null; data_plantao: string }>(
      'SELECT dados, data_plantao FROM lro_drafts WHERE id = $1',
      [referenciaId],
    );
    if (!result.rows.length) throw new NotFoundException('LRO não encontrado.');
    const dados = result.rows[0].dados ?? {};
    const chefeInformado = String(dados.chefeAssinatura || dados.chefeEquipe || '').trim();
    const cadastro = await this.database.query<{ id: string; nome_completo: string; nome_guerra: string; cargo: string }>(
      `SELECT id::text AS id, nome_completo, nome_guerra, cargo FROM bombeiros`,
    );
    const chefe = cadastro.rows.find(b => normalizarNome(b.nome_completo) === normalizarNome(chefeInformado))
      ?? cadastro.rows.find(b => normalizarNome(b.nome_guerra) === normalizarNome(chefeInformado));
    if (!chefeInformado) throw new BadRequestException('O LRO não tem chefe de equipe.');
    const gerente = await this.gerenteDoDia(dataISO(result.rows[0].data_plantao), cadastro.rows);
    return [
      { funcao: 'Chefe de equipe', nomeCompleto: chefe?.nome_completo ?? chefeInformado },
      { funcao: 'Gerente', nomeCompleto: gerente },
    ];
  }

  /**
   * Gerente que assina o LRO no dia do plantão: o titular (cargo GS) ou quem estiver no lugar dele,
   * pela mesma ordem do sistema — substituição aprovada, férias com substituto, vigência ativa.
   * De férias ou afastado sem substituto cadastrado, não deixa enviar.
   */
  private async gerenteDoDia(
    data: string,
    cadastro: { id: string; nome_completo: string; nome_guerra: string; cargo: string }[],
  ): Promise<string> {
    const titulares = cadastro.filter(b => String(b.cargo).toUpperCase() === 'GS');
    if (!titulares.length) throw new BadRequestException('Nenhum gerente (cargo GS) no cadastro de bombeiros.');
    if (titulares.length > 1) throw new BadRequestException('Há mais de um gerente (cargo GS) no cadastro de bombeiros.');
    const titular = titulares[0];
    const nomeDe = (id: string | null, nome: string | null) =>
      cadastro.find(b => b.id === String(id ?? ''))?.nome_completo || String(nome ?? '').trim();
    const noPeriodo = `left(data_inicio, 10) <= $2 AND left(coalesce(nullif(data_fim, ''), data_inicio), 10) >= $2`;

    const substituicao = await this.database.query<{ substituto_id: string | null; substituto_nome: string | null }>(
      `SELECT substituto_id, substituto_nome FROM substituicoes_temporarias
        WHERE funcionario_id = $1 AND status = 'Aprovada' AND ${noPeriodo}
          AND coalesce(substituto_id, substituto_nome, '') <> ''
        ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [titular.id, data],
    );
    if (substituicao.rows.length) return nomeDe(substituicao.rows[0].substituto_id, substituicao.rows[0].substituto_nome);

    const ferias = await this.database.query<{ substituto_id: string | null; substituto_nome: string | null }>(
      `SELECT substituto_id, substituto_nome FROM ferias
        WHERE funcionario_id = $1 AND status IN ('Programadas', 'Gozadas') AND ${noPeriodo}
        ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [titular.id, data],
    );
    if (ferias.rows.length) {
      const nome = nomeDe(ferias.rows[0].substituto_id, ferias.rows[0].substituto_nome);
      if (!nome) {
        throw new BadRequestException(`O gerente ${titular.nome_completo} está de férias neste plantão e não tem substituto cadastrado. Cadastre o substituto nas férias antes de enviar.`);
      }
      return nome;
    }

    const vigencia = await this.database.query<{ substituto_id: string | null; substituto_nome: string | null }>(
      `SELECT substituto_id, substituto_nome FROM vigencia_substituicoes
        WHERE funcionario_original_id = $1 AND ativa = true AND ${noPeriodo}
        ORDER BY nivel_cascata DESC NULLS LAST LIMIT 1`,
      [titular.id, data],
    );
    if (vigencia.rows.length) {
      const nome = nomeDe(vigencia.rows[0].substituto_id, vigencia.rows[0].substituto_nome);
      if (nome) return nome;
    }
    return titular.nome_completo;
  }

  /**
   * Troca: assinam o solicitante, o solicitado, o chefe de cada um (calculados pela tela com a mesma
   * regra do quadro de efetivos: equipe e função na data, considerando ferista, férias e substituições)
   * e o gerente do dia. Solicitante e solicitado são conferidos com o que está salvo na troca.
   */
  private async participantesTroca(referenciaId: string, informados: ParticipanteEnvio[]) {
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('Troca não encontrada.');
    const result = await this.database.query<{ filled_data: Record<string, string> | null; status: string }>(
      'SELECT filled_data, status FROM document_fills WHERE id = $1',
      [referenciaId],
    );
    if (!result.rows.length) throw new NotFoundException('Troca não encontrada.');
    const dados = result.rows[0].filled_data ?? {};
    const lista = Array.isArray(informados) ? informados : [];
    const doPapel = (papel: string) => String(lista.find(p => p.funcao === papel)?.nomeCompleto ?? '').trim();
    const confere = (papel: string, salvo: unknown) => {
      const nome = doPapel(papel);
      if (!nome) throw new BadRequestException(`Falta o ${papel.toLowerCase()} da troca.`);
      if (normalizarNome(nome) !== normalizarNome(salvo)) {
        throw new BadRequestException(`O ${papel.toLowerCase()} não confere com a troca salva.`);
      }
      return nome;
    };
    const solicitante = confere('Solicitante', dados.nome_solicitante);
    const solicitado = confere('Solicitado', dados.nome_solicitado);
    const chefeSolicitante = doPapel('Chefe do solicitante');
    const chefeSolicitado = doPapel('Chefe do solicitado');
    if (!chefeSolicitante) throw new BadRequestException('Não foi possível achar o chefe de equipe do solicitante nessa data.');
    if (!chefeSolicitado) throw new BadRequestException('Não foi possível achar o chefe de equipe do solicitado nessa data.');
    const cadastro = await this.database.query<{ id: string; nome_completo: string; nome_guerra: string; cargo: string }>(
      `SELECT id::text AS id, nome_completo, nome_guerra, cargo FROM bombeiros`,
    );
    const gerente = await this.gerenteDoDia(dataISO(dados.data_solicitada), cadastro.rows);
    return {
      status: result.rows[0].status,
      dataSolicitada: dataISO(dados.data_solicitada),
      participantes: [
        { funcao: 'Solicitante', nomeCompleto: solicitante },
        { funcao: 'Solicitado', nomeCompleto: solicitado },
        { funcao: 'Chefe do solicitante', nomeCompleto: chefeSolicitante },
        { funcao: 'Chefe do solicitado', nomeCompleto: chefeSolicitado },
        { funcao: 'Gerente', nomeCompleto: gerente },
      ] as ParticipanteEnvio[],
    };
  }

  /**
   * TP/EPR: o chefe de equipe e o gerente do dia assinam; os outros participantes da tabela só
   * reconhecem (não aparecem na folha e não seguram o documento).
   */
  private async participantesTpepr(referenciaId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('TP/EPR não encontrado.');
    const result = await this.database.query<{ data: string; equipe: string; chefe_equipe: string; participantes: unknown; status: string }>(
      'SELECT data, equipe, chefe_equipe, participantes, status FROM treinamentos_tpepr WHERE id = $1',
      [referenciaId],
    );
    const registro = result.rows[0];
    if (!registro) throw new NotFoundException('TP/EPR não encontrado.');
    const cadastro = await this.database.query<{ id: string; nome_completo: string; nome_guerra: string; cargo: string }>(
      `SELECT id::text AS id, nome_completo, nome_guerra, cargo FROM bombeiros`,
    );
    const nomeCompletoDe = (nome: string) => {
      const chave = normalizarNome(nome);
      return cadastro.rows.find(b => normalizarNome(b.nome_completo) === chave)?.nome_completo
        ?? cadastro.rows.find(b => normalizarNome(b.nome_guerra) === chave)?.nome_completo
        ?? nome.trim();
    };
    const chefeInformado = String(registro.chefe_equipe ?? '').trim();
    if (!chefeInformado) throw new BadRequestException('O TP/EPR não tem chefe de equipe.');
    const chefe = nomeCompletoDe(chefeInformado);
    const data = dataISO(registro.data);
    const gerente = await this.gerenteDoDia(data, cadastro.rows);

    const lista = Array.isArray(registro.participantes) ? registro.participantes as Record<string, unknown>[] : [];
    const assinam = new Set([normalizarNome(chefe), normalizarNome(gerente)]);
    const reconhecem: ParticipanteEnvio[] = [];
    for (const p of lista) {
      const nome = nomeCompletoDe(String(p?.nomeCompleto || p?.nomeGuerra || ''));
      if (!nome || assinam.has(normalizarNome(nome))) continue;
      if (reconhecem.some(r => normalizarNome(r.nomeCompleto) === normalizarNome(nome))) continue;
      reconhecem.push({ funcao: FUNCAO_RECONHECIMENTO, nomeCompleto: nome });
    }
    return {
      status: registro.status,
      data,
      equipe: registro.equipe,
      participantes: [
        { funcao: 'Chefe de equipe', nomeCompleto: chefe },
        { funcao: 'Gerente', nomeCompleto: gerente },
        ...reconhecem,
      ] as ParticipanteEnvio[],
    };
  }

  /**
   * TAF: todos os participantes assinam na linha deles (vagas p1 a p10); o chefe de equipe e o
   * gerente do dia (Gestor do SESCINC) também assinam no rodapé. Fica assinado com todos.
   */
  private async participantesTaf(referenciaId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('TAF não encontrado.');
    const result = await this.database.query<Record<string, unknown>>(
      'SELECT * FROM treinamentos_taf WHERE id = $1',
      [referenciaId],
    );
    const registro = result.rows[0];
    if (!registro) throw new NotFoundException('TAF não encontrado.');
    const cadastro = await this.database.query<{ id: string; nome_completo: string; nome_guerra: string; cargo: string }>(
      `SELECT id::text AS id, nome_completo, nome_guerra, cargo FROM bombeiros`,
    );
    const nomeCompletoDe = (nome: string) => {
      const chave = normalizarNome(nome);
      return cadastro.rows.find(b => normalizarNome(b.nome_completo) === chave)?.nome_completo
        ?? cadastro.rows.find(b => normalizarNome(b.nome_guerra) === chave)?.nome_completo
        ?? nome.trim();
    };
    const chefeInformado = String(registro.chefe_equipe ?? '').trim();
    if (!chefeInformado) throw new BadRequestException('O TAF não tem chefe de equipe.');
    const data = dataISO(registro.data);
    const gerente = await this.gerenteDoDia(data, cadastro.rows);

    // Linha da tabela de cada vaga preenchida (a linha N é a vaga pN, mesmo com vagas vazias no meio).
    const linhas: { linha: number; nomeCompleto: string; funcao: string }[] = [];
    for (let vaga = 1; vaga <= VAGAS_TAF; vaga += 1) {
      const nome = String(registro[`p${vaga}_nome`] ?? '').trim();
      if (!nome) continue;
      linhas.push({ linha: vaga - 1, nomeCompleto: nomeCompletoDe(nome), funcao: String(registro[`p${vaga}_funcao`] ?? '').trim() || 'BA' });
    }
    if (!linhas.length) throw new BadRequestException('O TAF não tem participantes.');
    return {
      status: String(registro.status ?? ''),
      data,
      equipe: String(registro.equipe ?? ''),
      linhas,
      chefe: nomeCompletoDe(chefeInformado),
      participantes: [
        ...linhas.map(l => ({ funcao: l.funcao, nomeCompleto: l.nomeCompleto })),
        { funcao: 'Gerente', nomeCompleto: gerente },
      ] as ParticipanteEnvio[],
    };
  }

  /**
   * Exercício de Posicionamento: cada BA-MC (motorista) e cada pessoa da equipagem assinam na
   * tabela das viaturas; o BA-CE (chefe) e o gerente do dia (GS) assinam no rodapé.
   * Os nomes da tabela são nomes de guerra; o e-mail vem do cadastro.
   */
  private async participantesPosicionamento(referenciaId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(referenciaId)) throw new NotFoundException('Exercício não encontrado.');
    const result = await this.database.query<Record<string, unknown>>(
      'SELECT * FROM exercicios_posicionamento WHERE id = $1',
      [referenciaId],
    );
    const registro = result.rows[0];
    if (!registro) throw new NotFoundException('Exercício não encontrado.');
    const cadastro = await this.database.query<{ id: string; nome_completo: string; nome_guerra: string; cargo: string }>(
      `SELECT id::text AS id, nome_completo, nome_guerra, cargo FROM bombeiros`,
    );
    const nomeCompletoDe = (nome: string) => {
      const chave = normalizarNome(nome);
      const porNomeCompleto = cadastro.rows.find(b => normalizarNome(b.nome_completo) === chave);
      if (porNomeCompleto) return porNomeCompleto.nome_completo;
      const porGuerra = cadastro.rows.filter(b => normalizarNome(b.nome_guerra) === chave);
      if (porGuerra.length > 1) throw new BadRequestException(`Mais de um bombeiro com o nome de guerra "${nome}" no cadastro.`);
      return porGuerra[0]?.nome_completo ?? nome.trim();
    };
    const chefeInformado = String(registro.chefe_equipe ?? '').trim();
    if (!chefeInformado) throw new BadRequestException('O exercício não tem chefe de equipe (BA-CE).');
    const data = dataISO(registro.data);
    const gerente = await this.gerenteDoDia(data, cadastro.rows);

    // Onde cada pessoa assina na tabela (a mesma pessoa pode estar em mais de um lugar).
    const marcas: { nomeCompleto: string; funcao: string; posicao: ReturnType<typeof posicaoMotorista> }[] = [];
    VIATURAS_POSICIONAMENTO.forEach((viatura, i) => {
      const motorista = String(registro[viatura.motorista] ?? '').trim();
      if (motorista) marcas.push({ nomeCompleto: nomeCompletoDe(motorista), funcao: 'BA-MC', posicao: posicaoMotorista(i) });
      const equipagem = viatura.equipagem.map(campo => String(registro[campo] ?? '').trim()).filter(Boolean);
      equipagem.forEach((nome, indice) => {
        marcas.push({ nomeCompleto: nomeCompletoDe(nome), funcao: 'Equipagem', posicao: posicaoEquipagem(i, indice, equipagem.length) });
      });
    });
    if (!marcas.length) throw new BadRequestException('O exercício não tem ninguém nas viaturas.');
    return {
      status: String(registro.status ?? ''),
      data,
      equipe: String(registro.equipe ?? ''),
      marcas,
      chefe: nomeCompletoDe(chefeInformado),
      participantes: [
        ...marcas.map(m => ({ funcao: m.funcao, nomeCompleto: m.nomeCompleto })),
        { funcao: 'Gerente', nomeCompleto: gerente },
      ] as ParticipanteEnvio[],
    };
  }

  /** Quem vai assinar, com o e-mail do cadastro, para conferir antes de enviar. */
  async previa(user: AuthUser, input: Omit<EnviarInput, 'pdf'>) {
    this.validarTipo(input.tipo);
    await this.verificarPermissaoEnvio(user, input.tipo, input.referenciaId);
    const pessoas = input.tipo === 'lro'
      ? await this.resolverSignatarios(await this.participantesLro(input.referenciaId))
      : input.tipo === 'troca'
        ? await this.resolverSignatarios((await this.participantesTroca(input.referenciaId, input.participantes)).participantes)
        : input.tipo === 'tpepr'
          ? await this.resolverSignatarios((await this.participantesTpepr(input.referenciaId)).participantes)
          : input.tipo === 'taf'
            ? await this.previaTaf(input.referenciaId)
            : input.tipo === 'posicionamento'
              ? await this.previaPosicionamento(input.referenciaId)
              : await this.resolverSignatarios(input.participantes, input.chefeEquipe);
    return pessoas.map(({ nome, funcoes, email, problema }) => ({ nome, funcoes, email, problema }));
  }

  async enviar(user: AuthUser, input: EnviarInput) {
    this.validarTipo(input.tipo);
    await this.verificarPermissaoEnvio(user, input.tipo, input.referenciaId);
    if (!input.pdf?.length) throw new BadRequestException('Envie o PDF do documento.');
    if (input.pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('O arquivo enviado não é um PDF.');
    if (input.tipo === 'lro') return this.enviarLro(user, input, input.pdf);
    if (input.tipo === 'troca') return this.enviarTroca(user, input, input.pdf);
    if (input.tipo === 'tpepr') return this.enviarTpepr(user, input, input.pdf);
    if (input.tipo === 'taf') return this.enviarTaf(user, input, input.pdf);
    if (input.tipo === 'posicionamento') return this.enviarPosicionamento(user, input, input.pdf);

    const registro = await this.database.query<{ data: unknown; is_apoc: boolean; origem_ptrba_id: string | null; equipe: string }>(
      'SELECT data, is_apoc, origem_ptrba_id, equipe FROM ptrba_completo_registros WHERE id = $1',
      [input.referenciaId],
    );
    const ptrba = registro.rows[0];
    if (!ptrba) throw new NotFoundException('PTR-BA não encontrado.');
    if (ptrba.origem_ptrba_id) throw new BadRequestException('O documento APOC legado é preservado somente para consulta.');
    if (dataISO(ptrba.data) < INICIO_ASSINATURA_PTRBA) {
      throw new BadRequestException('PTR-BA de plantões antes de 06/11/2026 não são enviados para assinatura pelo sistema.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, input.tipo, [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Este PTR-BA já foi enviado para assinatura.');

    const signatarios = await this.montarSignatarios(input.participantes, input.chefeEquipe);

    if (this.modoSimulado) {
      return this.gravarEnvio(user, input, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    // Envio real: cada pessoa assina na(s) linha(s) dela e o chefe também na linha do chefe.
    const linhas = linhasDaTabela(input.participantes, !!ptrba.is_apoc);
    const chaveChefe = normalizarNome(input.chefeEquipe);
    const paraAutentique: SignatarioAutentique[] = signatarios.map(s => ({
      email: s.email,
      action: 'SIGN',
      positions: posicoesDaPessoa({
        chave: s.chave,
        linhas,
        ehChefe: !!chaveChefe && s.chave === chaveChefe,
        normalizar: normalizarNome,
      }),
    }));

    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, dataISO(ptrba.data), ptrba.equipe);
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', 'PTRBA', dataISO(ptrba.data));
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf: input.pdf,
      signatarios: paraAutentique,
      pastaId,
    });

    const porEmail = new Map(documento.signatures
      .filter(s => s.email)
      .map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, input, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      // Se não deu para gravar aqui (ex.: alguém enviou ao mesmo tempo), não deixa o documento vivo lá.
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  /** Troca: todos recebem juntos (sem fila); cada um assina na sua linha e a data entra nos campos de data. */
  private async enviarTroca(user: AuthUser, input: EnviarInput, pdf: Buffer) {
    const { status, dataSolicitada, participantes } = await this.participantesTroca(input.referenciaId, input.participantes);
    if (status !== 'pending' && status !== 'draft') {
      throw new BadRequestException('Esta troca não está mais esperando o envio para assinatura.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, 'troca', [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Esta troca já foi enviada para assinatura.');

    const signatarios = await this.montarSignatarios(participantes);
    const dadosEnvio = { ...input, participantes };
    if (this.modoSimulado) {
      return this.gravarEnvio(user, dadosEnvio, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    // Mesmo e-mail em mais de uma pessoa só passa no sandbox; aí vira um pedido só com todas as marcações.
    const porEmailAutentique = new Map<string, SignatarioAutentique>();
    for (const s of signatarios) {
      const chave = s.email.toLowerCase();
      const posicoes = posicoesTroca(s.funcoes.filter(f => (PAPEIS_TROCA as string[]).includes(f)));
      const existente = porEmailAutentique.get(chave);
      if (existente) existente.positions.push(...posicoes);
      else porEmailAutentique.set(chave, { email: s.email, action: 'SIGN', positions: posicoes });
    }
    const paraAutentique = [...porEmailAutentique.values()];
    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, dataSolicitada, '', 'TROCA DE SERVICO');
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', DOCUMENTOS.troca.pasta, dataSolicitada);
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf,
      signatarios: paraAutentique,
      pastaId,
    });
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, dadosEnvio, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  /**
   * TP/EPR: todos recebem juntos (sem fila). Chefe e gerente assinam nas duas linhas do rodapé;
   * os outros só reconhecem (sem marca na folha). Fica assinado com chefe e gerente.
   */
  private async enviarTpepr(user: AuthUser, input: EnviarInput, pdf: Buffer) {
    const { status, data, equipe, participantes } = await this.participantesTpepr(input.referenciaId);
    if (status !== 'Rascunho') throw new BadRequestException('Este TP/EPR não está mais esperando o envio para assinatura.');
    if (data < INICIO_ASSINATURA_TPEPR) {
      throw new BadRequestException('TP/EPR de treinamentos antes de 08/11/2026 não são enviados para assinatura pelo sistema.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, 'tpepr', [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Este TP/EPR já foi enviado para assinatura.');

    const signatarios = await this.montarSignatarios(participantes);
    const dadosEnvio = { ...input, participantes };
    if (this.modoSimulado) {
      return this.gravarEnvio(user, dadosEnvio, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    // Mesmo e-mail em mais de uma pessoa só passa no sandbox; aí vira um pedido só (assina, se alguém assina).
    const porEmailAutentique = new Map<string, SignatarioAutentique>();
    for (const s of signatarios) {
      const chave = s.email.toLowerCase();
      const posicoes = [
        ...(s.funcoes.includes('Chefe de equipe') ? [posicaoTpepr('chefe')] : []),
        ...(s.funcoes.includes('Gerente') ? [posicaoTpepr('gerente')] : []),
      ];
      const existente = porEmailAutentique.get(chave);
      if (existente) {
        existente.positions.push(...posicoes);
        if (existente.positions.length) existente.action = 'SIGN';
      } else {
        porEmailAutentique.set(chave, { email: s.email, action: posicoes.length ? 'SIGN' : 'RECOGNIZE', positions: posicoes });
      }
    }
    const [ano, mes, dia] = data.split('-');
    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, data, equipe, `${dia}-${mes}-${ano} NVT TP EPR`);
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', DOCUMENTOS.tpepr.pasta, data);
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf,
      signatarios: [...porEmailAutentique.values()],
      pastaId,
    });
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, dadosEnvio, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  private async previaPosicionamento(referenciaId: string) {
    const { participantes, chefe } = await this.participantesPosicionamento(referenciaId);
    return this.resolverSignatarios(participantes, chefe);
  }

  /**
   * Exercício de Posicionamento: todos recebem juntos (sem fila). Cada um assina no(s) lugar(es)
   * dele na tabela; o BA-CE também no rodapé e o gerente do dia no traço do GS. Fica assinado com todos.
   */
  private async enviarPosicionamento(user: AuthUser, input: EnviarInput, pdf: Buffer) {
    const { status, data, equipe, marcas, chefe, participantes } = await this.participantesPosicionamento(input.referenciaId);
    if (status !== 'Rascunho') throw new BadRequestException('Este exercício não está mais esperando o envio para assinatura.');
    if (data < INICIO_ASSINATURA_POSICIONAMENTO) {
      throw new BadRequestException('Exercícios antes de 08/11/2026 não são enviados para assinatura pelo sistema.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, 'posicionamento', [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Este exercício já foi enviado para assinatura.');

    const signatarios = await this.montarSignatarios(participantes, chefe);
    const dadosEnvio = { ...input, participantes, chefeEquipe: chefe };
    if (this.modoSimulado) {
      return this.gravarEnvio(user, dadosEnvio, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    const porEmailAutentique = new Map<string, SignatarioAutentique>();
    for (const s of signatarios) {
      const posicoes = [
        ...marcas.filter(m => normalizarNome(m.nomeCompleto) === s.chave).map(m => m.posicao),
        ...(s.funcoes.includes('Chefe de equipe') ? [posicaoRodapePosicionamento('chefe')] : []),
        ...(s.funcoes.includes('Gerente') ? [posicaoRodapePosicionamento('gerente')] : []),
      ];
      const chave = s.email.toLowerCase();
      const existente = porEmailAutentique.get(chave);
      if (existente) existente.positions.push(...posicoes);
      else porEmailAutentique.set(chave, { email: s.email, action: 'SIGN', positions: posicoes });
    }
    const [ano, mes, dia] = data.split('-');
    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, data, equipe, `${dia}-${mes}-${ano} NVT EXERCICIO DE POSICIONAMENTO`);
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', DOCUMENTOS.posicionamento.pasta, data);
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf,
      signatarios: [...porEmailAutentique.values()],
      pastaId,
    });
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, dadosEnvio, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  private async previaTaf(referenciaId: string) {
    const { participantes, chefe } = await this.participantesTaf(referenciaId);
    return this.resolverSignatarios(participantes, chefe);
  }

  /**
   * TAF: todos recebem juntos (sem fila). Cada um assina na linha dele; o chefe também no traço do
   * chefe e o gerente do dia no traço do Gestor do SESCINC. Fica assinado quando todos assinarem.
   */
  private async enviarTaf(user: AuthUser, input: EnviarInput, pdf: Buffer) {
    const { status, data, equipe, linhas, chefe, participantes } = await this.participantesTaf(input.referenciaId);
    if (status !== 'Rascunho') throw new BadRequestException('Este TAF não está mais esperando o envio para assinatura.');
    if (data < INICIO_ASSINATURA_TAF) {
      throw new BadRequestException('TAF de treinamentos antes de 08/11/2026 não são enviados para assinatura pelo sistema.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, 'taf', [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Este TAF já foi enviado para assinatura.');

    const signatarios = await this.montarSignatarios(participantes, chefe);
    const dadosEnvio = { ...input, participantes, chefeEquipe: chefe };
    if (this.modoSimulado) {
      return this.gravarEnvio(user, dadosEnvio, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    // Mesmo e-mail em mais de uma pessoa só passa no sandbox; aí vira um pedido só com todas as marcações.
    const porEmailAutentique = new Map<string, SignatarioAutentique>();
    for (const s of signatarios) {
      const posicoes = [
        ...linhas.filter(l => normalizarNome(l.nomeCompleto) === s.chave).map(l => posicaoLinhaTaf(l.linha)),
        ...(s.funcoes.includes('Chefe de equipe') ? [posicaoRodapeTaf('chefe')] : []),
        ...(s.funcoes.includes('Gerente') ? [posicaoRodapeTaf('gerente')] : []),
      ];
      const chave = s.email.toLowerCase();
      const existente = porEmailAutentique.get(chave);
      if (existente) existente.positions.push(...posicoes);
      else porEmailAutentique.set(chave, { email: s.email, action: 'SIGN', positions: posicoes });
    }
    const [ano, mes, dia] = data.split('-');
    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, data, equipe, `${dia}-${mes}-${ano} NVT TAF`);
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', DOCUMENTOS.taf.pasta, data);
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf,
      signatarios: [...porEmailAutentique.values()],
      pastaId,
    });
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, dadosEnvio, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  /** LRO: chefe e gerente assinam nas linhas medidas pelo gerador do PDF, na página onde caíram. */
  private async enviarLro(user: AuthUser, input: EnviarInput, pdf: Buffer) {
    const registro = await this.database.query<{ data_plantao: string; equipe: string; status: string }>(
      'SELECT data_plantao, equipe, status FROM lro_drafts WHERE id = $1',
      [input.referenciaId],
    );
    const lro = registro.rows[0];
    if (!lro) throw new NotFoundException('LRO não encontrado.');
    if (lro.status !== 'rascunho' && lro.status !== 'aguardando') {
      throw new BadRequestException('Este LRO não está mais esperando o envio para assinatura.');
    }
    if (dataISO(lro.data_plantao) < INICIO_ASSINATURA_LRO) {
      throw new BadRequestException('LRO de plantões antes de 06/11/2026 não são enviados para assinatura pelo sistema.');
    }
    const ativos = await documentosComEnvioAtivo(this.database, 'lro', [input.referenciaId]);
    if (ativos.size) throw new ConflictException('Este LRO já foi enviado para assinatura.');

    const participantes = await this.participantesLro(input.referenciaId);
    const signatarios = await this.montarSignatarios(participantes);
    const linhas = validarLinhasLro(input.linhasAssinatura);
    if (!linhas.some(l => l.papel === 'chefe') || !linhas.some(l => l.papel === 'gerente')) {
      throw new BadRequestException('Não foi possível localizar as linhas de assinatura no PDF do LRO.');
    }
    const papelDe = (s: SignatarioMontado): 'chefe' | 'gerente' => (s.funcoes.includes('Gerente') ? 'gerente' : 'chefe');
    const dadosEnvio = { ...input, participantes };

    if (this.modoSimulado) {
      return this.gravarEnvio(user, dadosEnvio, {
        documentoId: `simulado-${randomUUID()}`,
        sandbox: true,
        signatarios: signatarios.map(s => ({ ...s, signatureId: `simulado-${randomUUID()}` })),
      });
    }

    const paraAutentique: SignatarioAutentique[] = signatarios.map(s => ({
      email: s.email,
      action: 'SIGN',
      // Se o chefe também for o gerente (mesma pessoa), assina nas duas linhas.
      positions: linhas
        .filter(l => l.papel === papelDe(s) || (s.funcoes.includes('Gerente') && s.funcoes.includes('Chefe de equipe')))
        .map(posicaoNaLinhaLro),
    }));
    const data = dataISO(lro.data_plantao);
    const [ano, mes, dia] = data.split('-');
    const nomeArquivo = this.nomeArquivo(input.nomeArquivo, data, lro.equipe, `${dia}-${mes}-${ano} NVT LRO`);
    const pastaId = await this.api.pastaDoMes('NAVEGANTES', DOCUMENTOS.lro.pasta, data);
    const documento = await this.api.criarDocumento({
      nome: nomeArquivo.replace(/\.pdf$/i, ''),
      nomeArquivo,
      pdf,
      signatarios: paraAutentique,
      pastaId,
    });
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s.public_id]));
    try {
      return await this.gravarEnvio(user, dadosEnvio, {
        documentoId: documento.id,
        sandbox: this.api.sandbox,
        signatarios: signatarios.map(s => ({ ...s, signatureId: porEmail.get(s.email.toLowerCase()) ?? null })),
      });
    } catch (erro) {
      await this.api.cancelar(documento.id).catch(e => this.logger.error(`Documento ${documento.id} ficou no Autentique: ${(e as Error).message}`));
      throw erro;
    }
  }

  private nomeArquivo(informado: string | undefined, data: string, equipe: string, prefixoPadrao?: string): string {
    const limpo = String(informado ?? '').replace(/[\\/:*?"<>|\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
    if (limpo) return /\.pdf$/i.test(limpo) ? limpo : `${limpo}.pdf`;
    const [ano, mes, dia] = data.split('-');
    const prefixo = prefixoPadrao ?? `${dia}-${mes}-${ano} NVT PTRBA`;
    return `${prefixo} ${String(equipe ?? '').toUpperCase()}.pdf`.replace(/\s+/g, ' ');
  }

  private gravarEnvio(
    user: AuthUser,
    input: EnviarInput,
    dados: { documentoId: string; sandbox: boolean; signatarios: (SignatarioMontado & { signatureId: string | null })[] },
  ) {
    const doc = DOCUMENTOS[input.tipo];
    return this.database.transaction(async client => {
      const registro = await client.query(`SELECT id FROM ${doc.tabela} WHERE id = $1 FOR UPDATE`, [input.referenciaId]);
      if (!registro.rows.length) throw new NotFoundException(`${doc.nome} não encontrado.`);
      const ativos = await documentosComEnvioAtivo(client, input.tipo, [input.referenciaId]);
      if (ativos.size) throw new ConflictException(`Este ${doc.nome} já foi enviado para assinatura.`);

      if (input.tipo === 'lro') {
        // Enviado: sai de rascunho e fica aguardando as assinaturas.
        await client.query(`UPDATE lro_drafts SET status = 'aguardando', updated_at = now() WHERE id = $1`, [input.referenciaId]);
      }
      if (input.tipo === 'ptrba') {
        // O que foi enviado vira o conteudo oficial do registro.
        await client.query(
          'UPDATE ptrba_completo_registros SET participantes = $2::jsonb, chefe_equipe = $3 WHERE id = $1',
          [input.referenciaId, JSON.stringify(input.participantes), input.chefeEquipe ?? ''],
        );
      }
      const envio = await client.query<{ id: string }>(
        `INSERT INTO autentique_envios (tipo, referencia_id, autentique_document_id, sandbox, enviado_por_id, enviado_por_nome)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.tipo, input.referenciaId, dados.documentoId, dados.sandbox, user.id, user.username],
      );
      const envioId = envio.rows[0].id;
      for (const signatario of dados.signatarios) {
        await client.query(
          `INSERT INTO autentique_signatarios (envio_id, ordem, funcoes, nome, email, celular, autentique_signature_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [envioId, signatario.ordem, signatario.funcoes.join(','), signatario.nome, signatario.email, signatario.celular, signatario.signatureId],
        );
      }
      return { id: envioId };
    });
  }

  async reenviar(user: AuthUser, envioId: string) {
    const envio = await this.obterEnvio(envioId);
    if (!this.podeGerir(user, envio)) throw new ForbiddenException('Você não pode reenviar os avisos deste documento.');
    if (envio.status !== 'aguardando') throw new BadRequestException('Só é possível reenviar avisos de documentos aguardando assinatura.');
    const pendentes = await this.database.query<{ autentique_signature_id: string | null }>(
      `SELECT autentique_signature_id FROM autentique_signatarios WHERE envio_id = $1 AND status = 'pendente'`,
      [envioId],
    );
    const ids = pendentes.rows.map(row => row.autentique_signature_id).filter((id): id is string => !!id);
    if (!this.ehSimulado(envio)) await this.api.reenviar(ids);
    return { reenviados: pendentes.rowCount ?? 0 };
  }

  /** Link pessoal de assinatura de uma pessoa, para mandar pelo WhatsApp. Gera uma vez e guarda. */
  async linkDeAssinatura(user: AuthUser, envioId: string, signatarioId: string) {
    const envio = await this.obterEnvio(envioId);
    if (!this.podeGerir(user, envio)) throw new ForbiddenException('Você não pode ver os links de assinatura deste documento.');
    if (envio.status !== 'aguardando') throw new BadRequestException('Este documento não está aguardando assinatura.');
    if (!/^[0-9a-f-]{36}$/i.test(signatarioId)) throw new NotFoundException('Signatário não encontrado.');
    const result = await this.database.query<SignatarioRow>(
      'SELECT * FROM autentique_signatarios WHERE id = $1 AND envio_id = $2',
      [signatarioId, envioId],
    );
    const signatario = result.rows[0];
    if (!signatario) throw new NotFoundException('Signatário não encontrado.');
    if (signatario.status !== 'pendente') throw new BadRequestException('Esta pessoa já respondeu ao documento.');
    if (signatario.link) return { link: signatario.link };
    if (!signatario.autentique_signature_id) throw new ServiceUnavailableException('Esta assinatura não tem identificação no Autentique.');
    const link = this.ehSimulado(envio)
      ? `https://www.autentique.com.br/simulado/${randomUUID().slice(0, 8)}`
      : await this.api.linkDeAssinatura(signatario.autentique_signature_id);
    await this.database.query('UPDATE autentique_signatarios SET link = $2 WHERE id = $1', [signatario.id, link]);
    return { link };
  }

  async cancelar(user: AuthUser, envioId: string) {
    if (!isAdmin(user)) throw new ForbiddenException('Só um administrador pode cancelar o envio.');
    const envio = await this.obterEnvio(envioId);
    if (envio.status === 'cancelado') return { id: envio.id };
    if (!this.ehSimulado(envio)) await this.api.cancelar(envio.autentique_document_id);
    await this.database.query(
      `UPDATE autentique_envios SET status = 'cancelado', cancelado_em = now(), cancelado_por_nome = $2 WHERE id = $1`,
      [envioId, user.username],
    );
    // TP/EPR, TAF e Posicionamento cancelados voltam a ser rascunho, para corrigir e enviar de novo.
    if (envio.tipo === 'tpepr' || envio.tipo === 'taf' || envio.tipo === 'posicionamento') {
      await this.database.query(
        `UPDATE ${DOCUMENTOS[envio.tipo].tabela} SET status = 'Rascunho', aprovado_por = '', aprovado_por_nome = '', aprovado_em = '' WHERE id = $1`,
        [envio.referencia_id],
      );
    }
    // LRO cancelado volta a ser rascunho, para corrigir e enviar de novo.
    if (envio.tipo === 'lro') {
      await this.database.query(
        `UPDATE lro_drafts SET status = 'rascunho', updated_at = now() WHERE id = $1 AND status IN ('aguardando', 'assinado')`,
        [envio.referencia_id],
      );
    }
    return { id: envio.id };
  }

  /** Botão "Atualizar": consulta o Autentique (R$ 0,001) quando o aviso automático não chegou. */
  async atualizar(user: AuthUser, envioId: string) {
    const envio = await this.obterEnvio(envioId);
    if (this.ehSimulado(envio) || envio.status === 'cancelado') return { status: envio.status };
    // Nada mais a buscar: todo mundo já respondeu e o PDF está guardado.
    const pendentes = await this.database.query(
      `SELECT 1 FROM autentique_signatarios WHERE envio_id = $1 AND status = 'pendente' LIMIT 1`,
      [envio.id],
    );
    if (!pendentes.rowCount && envio.pdf_assinado_url) return { status: envio.status };
    return { status: await this.sincronizar(envio) };
  }

  /** Última conferência de cada envio pelo webhook (evita consultas repetidas e avisos falsos em série). */
  private readonly ultimaConferencia = new Map<string, number>();

  /**
   * Aviso do Autentique (webhook). O conteúdo nunca é usado como verdade: o aviso só "cutuca" o sistema
   * a consultar no Autentique documentos que nós enviamos e que ainda têm algo pendente, no máximo
   * uma vez por minuto cada. Assim um aviso falso não muda nada nem gera gasto relevante.
   * Se houver segredo configurado e o Autentique mandar o cabeçalho, a assinatura HMAC é conferida.
   */
  async receberWebhook(corpo: Buffer | undefined, assinatura: string | undefined) {
    if (!corpo?.length) return { ok: true };
    const segredo = this.config.get<string>('AUTENTIQUE_WEBHOOK_SECRET')?.trim();
    if (segredo && assinatura) {
      const esperado = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'));
      const recebido = Buffer.from(assinatura.trim().toLowerCase());
      const confere = esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
      // Mesmo sem conferir, segue: o aviso só leva a uma consulta segura no Autentique.
      this.logger.log(`Webhook do Autentique recebido: assinatura ${confere ? 'confere' : 'NÃO confere com o segredo configurado'}.`);
    } else {
      this.logger.log(`Webhook do Autentique recebido ${assinatura ? 'com' : 'sem'} cabeçalho de assinatura${segredo ? '' : ' (sem segredo configurado)'}.`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(corpo.toString('utf8'));
    } catch {
      return { ok: true };
    }
    // O id do documento pode vir em lugares diferentes conforme o evento: procura qualquer texto que bata.
    const textos = new Set<string>();
    const coletar = (valor: unknown, profundidade: number) => {
      if (profundidade > 6 || textos.size > 200) return;
      if (typeof valor === 'string' && /^[0-9a-f]{20,80}$/i.test(valor)) textos.add(valor);
      else if (Array.isArray(valor)) valor.forEach(v => coletar(v, profundidade + 1));
      else if (valor && typeof valor === 'object') Object.values(valor).forEach(v => coletar(v, profundidade + 1));
    };
    coletar(payload, 0);
    if (!textos.size) return { ok: true };
    // Só documentos nossos com alguém pendente ou sem o PDF assinado guardado.
    const envios = await this.database.query<EnvioRow>(
      `SELECT e.* FROM autentique_envios e
        WHERE e.status <> 'cancelado' AND e.autentique_document_id = ANY($1::text[])
          AND (e.pdf_assinado_url IS NULL OR EXISTS (
            SELECT 1 FROM autentique_signatarios s WHERE s.envio_id = e.id AND s.status = 'pendente'))`,
      [[...textos]],
    );
    const agora = Date.now();
    for (const envio of envios.rows) {
      if (agora - (this.ultimaConferencia.get(envio.id) ?? 0) < 60_000) continue;
      this.ultimaConferencia.set(envio.id, agora);
      await this.sincronizar(envio).catch(e => this.logger.warn(`Falha ao atualizar envio ${envio.id}: ${(e as Error).message}`));
    }
    return { ok: true };
  }

  /**
   * Lê a situação no Autentique e grava quem assinou. Com todos os BA assinados, o documento fica
   * assinado e o PDF é guardado; cada nova assinatura (ex.: um APOC depois) atualiza o PDF.
   */
  private async sincronizar(envio: EnvioRow): Promise<string> {
    const documento = await this.api.situacao(envio.autentique_document_id);
    const signatarios = await this.database.query<SignatarioRow>(
      'SELECT * FROM autentique_signatarios WHERE envio_id = $1',
      [envio.id],
    );
    const porId = new Map(documento.signatures.map(s => [s.public_id, s]));
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s]));

    let baAssinaram = signatarios.rows.some(s => !naoSeguraDocumento(s.funcoes));
    let alguemRecusou = false;
    let mudou = false;
    let alguemAssinou = false;
    for (const signatario of signatarios.rows) {
      const lido = (signatario.autentique_signature_id && porId.get(signatario.autentique_signature_id))
        || porEmail.get(String(signatario.email ?? '').toLowerCase());
      const status = lido?.rejected ? 'recusado' : lido?.signed ? 'assinado' : 'pendente';
      const naoSegura = naoSeguraDocumento(signatario.funcoes);
      if (status === 'assinado') alguemAssinou = true;
      if (!naoSegura && status !== 'assinado') baAssinaram = false;
      if (!naoSegura && status === 'recusado') alguemRecusou = true;
      if (status !== signatario.status) {
        mudou = true;
        await this.database.query(
          `UPDATE autentique_signatarios SET status = $2, assinado_em = $3, recusado_em = $4 WHERE id = $1`,
          [signatario.id, status, lido?.signed?.created_at ?? null, lido?.rejected?.created_at ?? null],
        );
      }
    }

    const novoStatus = alguemRecusou ? 'recusado' : baAssinaram ? 'assinado' : 'aguardando';
    let pdfPath: string | null = envio.pdf_assinado_url;
    // Guarda o PDF com as assinaturas já feitas a cada assinatura nova (para o Ver documento mostrar).
    if (alguemAssinou && (!pdfPath || mudou) && documento.files?.signed) {
      try {
        const pdf = await this.api.baixarPdfAssinado(documento.files.signed);
        const caminho = `${envio.tipo}/${envio.referencia_id}/${envio.id}.pdf`;
        await this.storage.upload(BUCKET_ASSINADOS, caminho, { buffer: pdf } as Express.Multer.File);
        pdfPath = caminho;
      } catch (erro) {
        this.logger.warn(`Não foi possível guardar o PDF assinado do envio ${envio.id}: ${(erro as Error).message}`);
      }
    }
    await this.database.query(
      `UPDATE autentique_envios
          SET status = $2,
              concluido_em = CASE WHEN $2 = 'aguardando' THEN NULL ELSE coalesce(concluido_em, now()) END,
              pdf_assinado_url = $3
        WHERE id = $1 AND status <> 'cancelado'`,
      [envio.id, novoStatus, pdfPath],
    );
    // LRO: com o chefe e o gerente assinados, o livro fica "Assinado" sozinho (é a etapa final).
    // Troca: com todas as assinaturas (gerente incluído) fica Aprovada sozinha.
    if (envio.tipo === 'troca' && novoStatus === 'assinado') {
      await this.database.query(
        `UPDATE document_fills SET status = 'signed', updated_at = now() WHERE id = $1 AND status IN ('pending', 'draft')`,
        [envio.referencia_id],
      );
    }
    // TP/EPR (chefe e gerente) e TAF (todos): com as assinaturas fica Aprovado sozinho.
    if ((envio.tipo === 'tpepr' || envio.tipo === 'taf' || envio.tipo === 'posicionamento') && novoStatus === 'assinado') {
      await this.database.query(
        `UPDATE ${DOCUMENTOS[envio.tipo].tabela}
            SET status = 'Aprovado', aprovado_por = 'autentique', aprovado_por_nome = 'Assinado no Autentique',
                aprovado_em = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          WHERE id = $1 AND status <> 'Aprovado'`,
        [envio.referencia_id],
      );
    }
    if (envio.tipo === 'lro' && novoStatus === 'assinado') {
      await this.database.query(
        `UPDATE lro_drafts SET status = 'assinado', updated_at = now() WHERE id = $1 AND status = 'aguardando'`,
        [envio.referencia_id],
      );
    }
    return novoStatus;
  }

  /** PDF assinado guardado no servidor (baixa do Autentique na hora se ainda não tiver). */
  async pdfAssinado(envioId: string) {
    let envio = await this.obterEnvio(envioId);
    if (envio.status === 'cancelado') throw new BadRequestException('Este envio foi cancelado.');
    if (!envio.pdf_assinado_url && !this.ehSimulado(envio)) {
      await this.sincronizar(envio);
      envio = await this.obterEnvio(envioId);
    }
    if (!envio.pdf_assinado_url) throw new NotFoundException('Ainda ninguém assinou este documento.');
    return this.storage.getFile(BUCKET_ASSINADOS, envio.pdf_assinado_url);
  }

  private async obterEnvio(envioId: string): Promise<EnvioRow> {
    if (!/^[0-9a-f-]{36}$/i.test(envioId)) throw new NotFoundException('Envio não encontrado.');
    const result = await this.database.query<EnvioRow>('SELECT * FROM autentique_envios WHERE id = $1', [envioId]);
    if (!result.rows.length) throw new NotFoundException('Envio não encontrado.');
    return result.rows[0];
  }

  private validarTipo(tipo: string) {
    if (!TIPOS_ENVIO.has(tipo)) throw new BadRequestException('Tipo de documento inválido.');
  }

  /**
   * Cada pessoa entra uma vez so, mesmo que apareca em mais de um lugar (ex.: BA-CE e chefe).
   * E-mail e celular vem do cadastro, nunca do navegador.
   */
  private async montarSignatarios(participantes: ParticipanteEnvio[], chefeEquipe?: string): Promise<SignatarioMontado[]> {
    const pessoas = await this.resolverSignatarios(participantes, chefeEquipe);
    const nomes = (problema: Problema) => pessoas.filter(p => p.problema === problema).map(p => p.nome).join(', ');
    const problemas = [
      nomes('sem_cadastro') && `Não encontrado no cadastro: ${nomes('sem_cadastro')}.`,
      nomes('sem_email') && `Sem e-mail válido no cadastro: ${nomes('sem_email')}.`,
      nomes('email_repetido') && `Mesmo e-mail no cadastro de mais de uma pessoa: ${nomes('email_repetido')}.`,
    ].filter(Boolean);
    if (problemas.length) throw new BadRequestException(problemas.join(' '));
    return pessoas.map(({ ordem, chave, funcoes, nome, email, celular }) => ({ ordem, chave, funcoes, nome, email, celular }));
  }

  private async resolverSignatarios(
    participantes: ParticipanteEnvio[],
    chefeEquipe?: string,
  ): Promise<(SignatarioMontado & { problema: Problema | null })[]> {
    if (!Array.isArray(participantes)) throw new BadRequestException('Lista de participantes inválida.');
    const pessoas = new Map<string, { nome: string; funcoes: string[] }>();
    const adicionar = (nome: string, funcao: string) => {
      const chave = normalizarNome(nome);
      if (!chave) return;
      const pessoa = pessoas.get(chave) ?? { nome: nome.trim(), funcoes: [] };
      if (funcao && !pessoa.funcoes.includes(funcao)) pessoa.funcoes.push(funcao);
      pessoas.set(chave, pessoa);
    };
    for (const participante of participantes) {
      const situacao = String(participante.situacao ?? '').trim().toUpperCase();
      if (SITUACOES_SEM_ASSINATURA.has(situacao)) continue;
      adicionar(String(participante.nomeCompleto ?? ''), String(participante.funcao ?? '').trim());
    }
    if (chefeEquipe) adicionar(chefeEquipe, 'Chefe de equipe');
    if (!pessoas.size) throw new BadRequestException('Nenhum participante para assinar.');

    const cadastro = await this.database.query<{ nome_completo: string; email: string; celular: string }>(
      `SELECT nome_completo, email, celular FROM bombeiros
       UNION ALL
       SELECT nome_completo, email, '' AS celular FROM apocs`,
    );
    const porNome = new Map<string, { email: string; celular: string }>();
    for (const row of cadastro.rows) {
      const chave = normalizarNome(row.nome_completo);
      if (!porNome.has(chave)) porNome.set(chave, { email: String(row.email ?? '').trim(), celular: String(row.celular ?? '').trim() });
    }

    // O Autentique identifica cada pessoa pelo e-mail: duas pessoas com o mesmo e-mail não dá.
    const usoDoEmail = new Map<string, number>();
    for (const chave of pessoas.keys()) {
      const email = porNome.get(chave)?.email.toLowerCase();
      if (email) usoDoEmail.set(email, (usoDoEmail.get(email) ?? 0) + 1);
    }

    let ordem = 0;
    return [...pessoas].map(([chave, pessoa]) => {
      ordem += 1;
      const dados = porNome.get(chave);
      const email = dados?.email ?? '';
      const problema: Problema | null = !dados ? 'sem_cadastro'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'sem_email'
          // No sandbox (testes) várias pessoas podem usar o mesmo e-mail: viram um só pedido de assinatura.
          : (usoDoEmail.get(email.toLowerCase()) ?? 0) > 1 && !this.api.sandbox ? 'email_repetido'
            : null;
      return { ordem, chave, funcoes: pessoa.funcoes, nome: pessoa.nome, email, celular: dados?.celular ?? '', problema };
    });
  }
}
