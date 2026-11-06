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
import { linhasDaTabela, posicoesDaPessoa } from './posicoes-ptrba';

export const TIPOS_ENVIO = new Set(['ptrba']);

/** Situacoes do PTR-BA que nao assinam (ausente). */
const SITUACOES_SEM_ASSINATURA = new Set(['A']);

/** Papeis que podem enviar, reenviar e ver os links de assinatura. */
const PAPEIS_GESTAO = new Set(['gerente', 'chefe', 'lider']);

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

  private async verificarPermissaoEnvio(user: AuthUser, referenciaId: string) {
    if (this.podeGerir(user)) return;
    const registro = await this.database.query<{ created_by: string }>(
      'SELECT created_by FROM ptrba_completo_registros WHERE id = $1',
      [referenciaId],
    );
    if (normalizarNome(registro.rows[0]?.created_by) !== normalizarNome(user.username)) {
      throw new ForbiddenException('Só quem criou o PTR-BA, a chefia ou um administrador pode enviar para assinatura.');
    }
  }

  /** Quem vai assinar, com o e-mail do cadastro, para conferir antes de enviar. */
  async previa(user: AuthUser, input: Omit<EnviarInput, 'pdf'>) {
    this.validarTipo(input.tipo);
    await this.verificarPermissaoEnvio(user, input.referenciaId);
    const pessoas = await this.resolverSignatarios(input.participantes, input.chefeEquipe);
    return pessoas.map(({ nome, funcoes, email, problema }) => ({ nome, funcoes, email, problema }));
  }

  async enviar(user: AuthUser, input: EnviarInput) {
    this.validarTipo(input.tipo);
    await this.verificarPermissaoEnvio(user, input.referenciaId);
    if (!input.pdf?.length) throw new BadRequestException('Envie o PDF do documento.');
    if (input.pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('O arquivo enviado não é um PDF.');

    const registro = await this.database.query<{ data: unknown; is_apoc: boolean; origem_ptrba_id: string | null; equipe: string }>(
      'SELECT data, is_apoc, origem_ptrba_id, equipe FROM ptrba_completo_registros WHERE id = $1',
      [input.referenciaId],
    );
    const ptrba = registro.rows[0];
    if (!ptrba) throw new NotFoundException('PTR-BA não encontrado.');
    if (ptrba.origem_ptrba_id) throw new BadRequestException('O documento APOC legado é preservado somente para consulta.');
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

  private nomeArquivo(informado: string | undefined, data: string, equipe: string): string {
    const limpo = String(informado ?? '').replace(/[\\/:*?"<>|\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
    if (limpo) return /\.pdf$/i.test(limpo) ? limpo : `${limpo}.pdf`;
    const [ano, mes, dia] = data.split('-');
    return `${dia}-${mes}-${ano} NVT PTRBA ${String(equipe ?? '').toUpperCase()}.pdf`.replace(/\s+/g, ' ');
  }

  private gravarEnvio(
    user: AuthUser,
    input: EnviarInput,
    dados: { documentoId: string; sandbox: boolean; signatarios: (SignatarioMontado & { signatureId: string | null })[] },
  ) {
    return this.database.transaction(async client => {
      const registro = await client.query('SELECT id FROM ptrba_completo_registros WHERE id = $1 FOR UPDATE', [input.referenciaId]);
      if (!registro.rows.length) throw new NotFoundException('PTR-BA não encontrado.');
      const ativos = await documentosComEnvioAtivo(client, input.tipo, [input.referenciaId]);
      if (ativos.size) throw new ConflictException('Este PTR-BA já foi enviado para assinatura.');

      // O que foi enviado vira o conteudo oficial do registro.
      await client.query(
        'UPDATE ptrba_completo_registros SET participantes = $2::jsonb, chefe_equipe = $3 WHERE id = $1',
        [input.referenciaId, JSON.stringify(input.participantes), input.chefeEquipe ?? ''],
      );
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
    return { id: envio.id };
  }

  /** Botão "Atualizar": consulta o Autentique (R$ 0,001) quando o aviso automático não chegou. */
  async atualizar(user: AuthUser, envioId: string) {
    const envio = await this.obterEnvio(envioId);
    if (envio.status !== 'aguardando' && envio.pdf_assinado_url) return { status: envio.status };
    if (this.ehSimulado(envio)) return { status: envio.status };
    return { status: await this.sincronizar(envio) };
  }

  /**
   * Aviso do Autentique (webhook). Confere a assinatura HMAC do corpo e, em vez de confiar no conteúdo,
   * consulta o documento no Autentique para saber quem assinou.
   */
  async receberWebhook(corpo: Buffer | undefined, assinatura: string | undefined) {
    const segredo = this.config.get<string>('AUTENTIQUE_WEBHOOK_SECRET')?.trim();
    if (!segredo) throw new ServiceUnavailableException('Webhook do Autentique não configurado.');
    if (!corpo?.length || !assinatura) throw new ForbiddenException('Assinatura do aviso ausente.');
    const esperado = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'));
    const recebido = Buffer.from(assinatura.trim().toLowerCase());
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
      throw new ForbiddenException('Assinatura do aviso inválida.');
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
    const envios = await this.database.query<EnvioRow>(
      `SELECT * FROM autentique_envios WHERE status = 'aguardando' AND autentique_document_id = ANY($1::text[])`,
      [[...textos]],
    );
    for (const envio of envios.rows) {
      await this.sincronizar(envio).catch(e => this.logger.warn(`Falha ao atualizar envio ${envio.id}: ${(e as Error).message}`));
    }
    return { ok: true };
  }

  /** Lê a situação no Autentique e grava quem assinou; com todos assinados, guarda o PDF assinado. */
  private async sincronizar(envio: EnvioRow): Promise<string> {
    const documento = await this.api.situacao(envio.autentique_document_id);
    const signatarios = await this.database.query<SignatarioRow>(
      'SELECT * FROM autentique_signatarios WHERE envio_id = $1',
      [envio.id],
    );
    const porId = new Map(documento.signatures.map(s => [s.public_id, s]));
    const porEmail = new Map(documento.signatures.filter(s => s.email).map(s => [String(s.email).toLowerCase(), s]));

    let todosAssinaram = signatarios.rows.length > 0;
    let alguemRecusou = false;
    for (const signatario of signatarios.rows) {
      const lido = (signatario.autentique_signature_id && porId.get(signatario.autentique_signature_id))
        || porEmail.get(String(signatario.email ?? '').toLowerCase());
      const status = lido?.rejected ? 'recusado' : lido?.signed ? 'assinado' : 'pendente';
      if (status !== 'assinado') todosAssinaram = false;
      if (status === 'recusado') alguemRecusou = true;
      if (status !== signatario.status) {
        await this.database.query(
          `UPDATE autentique_signatarios SET status = $2, assinado_em = $3, recusado_em = $4 WHERE id = $1`,
          [signatario.id, status, lido?.signed?.created_at ?? null, lido?.rejected?.created_at ?? null],
        );
      }
    }

    const novoStatus = alguemRecusou ? 'recusado' : todosAssinaram ? 'assinado' : 'aguardando';
    let pdfPath: string | null = envio.pdf_assinado_url;
    if (novoStatus === 'assinado' && !pdfPath && documento.files?.signed) {
      try {
        const pdf = await this.api.baixarPdfAssinado(documento.files.signed);
        pdfPath = `${envio.tipo}/${envio.referencia_id}/${envio.id}.pdf`;
        await this.storage.upload(BUCKET_ASSINADOS, pdfPath, { buffer: pdf } as Express.Multer.File);
      } catch (erro) {
        pdfPath = null;
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
    return novoStatus;
  }

  /** PDF assinado guardado no servidor (baixa do Autentique na hora se ainda não tiver). */
  async pdfAssinado(envioId: string) {
    let envio = await this.obterEnvio(envioId);
    if (envio.status !== 'assinado') throw new BadRequestException('O documento ainda não foi assinado por todos.');
    if (!envio.pdf_assinado_url && !this.ehSimulado(envio)) {
      await this.sincronizar(envio);
      envio = await this.obterEnvio(envioId);
    }
    if (!envio.pdf_assinado_url) throw new NotFoundException('O PDF assinado ainda não está disponível.');
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
          : (usoDoEmail.get(email.toLowerCase()) ?? 0) > 1 ? 'email_repetido'
            : null;
      return { ordem, chave, funcoes: pessoa.funcoes, nome: pessoa.nome, email, celular: dados?.celular ?? '', problema };
    });
  }
}
