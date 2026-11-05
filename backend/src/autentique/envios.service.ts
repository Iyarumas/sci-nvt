import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthUser, isAdmin } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

export const TIPOS_ENVIO = new Set(['ptrba']);

/** Situacoes do PTR-BA que nao assinam (ausente). */
const SITUACOES_SEM_ASSINATURA = new Set(['A']);

/** Papeis que podem enviar, reenviar e ver os links de assinatura. */
const PAPEIS_GESTAO = new Set(['gerente', 'chefe', 'lider']);

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
}

interface SignatarioMontado {
  ordem: number;
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
  celular: string;
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

/** Um documento com envio ativo (aguardando, assinado ou recusado) nao pode mais ser alterado. */
export async function documentosComEnvioAtivo(
  client: Pick<PoolClient, 'query'>,
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
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /** Sem a integracao real, o modo simulado deixa testar a tela localmente. Nunca vale em producao. */
  private get modoSimulado(): boolean {
    return this.config.get<string>('AUTENTIQUE_MODO') === 'simulado' && process.env.NODE_ENV !== 'production';
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
            // O link assina como a pessoa: so vai para quem pode cobrar a assinatura.
            link: gerir ? signatario.link : null,
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

    const signatarios = await this.montarSignatarios(input.participantes, input.chefeEquipe);

    if (!this.modoSimulado) {
      throw new ServiceUnavailableException('O envio ao Autentique ainda não foi configurado.');
    }

    return this.database.transaction(async client => {
      const registro = await client.query(
        'SELECT id, origem_ptrba_id FROM ptrba_completo_registros WHERE id = $1 FOR UPDATE',
        [input.referenciaId],
      );
      if (!registro.rows.length) throw new NotFoundException('PTR-BA não encontrado.');
      if (registro.rows[0].origem_ptrba_id) {
        throw new BadRequestException('O documento APOC legado é preservado somente para consulta.');
      }
      const ativos = await documentosComEnvioAtivo(client, input.tipo, [input.referenciaId]);
      if (ativos.size) throw new ConflictException('Este PTR-BA já foi enviado para assinatura.');

      // O que foi enviado vira o conteudo oficial do registro.
      await client.query(
        'UPDATE ptrba_completo_registros SET participantes = $2::jsonb, chefe_equipe = $3 WHERE id = $1',
        [input.referenciaId, JSON.stringify(input.participantes), input.chefeEquipe ?? ''],
      );
      const envio = await client.query<{ id: string }>(
        `INSERT INTO autentique_envios (tipo, referencia_id, autentique_document_id, sandbox, enviado_por_id, enviado_por_nome)
         VALUES ($1, $2, $3, true, $4, $5) RETURNING id`,
        [input.tipo, input.referenciaId, `simulado-${randomUUID()}`, user.id, user.username],
      );
      const envioId = envio.rows[0].id;
      for (const signatario of signatarios) {
        await client.query(
          `INSERT INTO autentique_signatarios (envio_id, ordem, funcoes, nome, email, celular, autentique_signature_id, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            envioId,
            signatario.ordem,
            signatario.funcoes.join(','),
            signatario.nome,
            signatario.email,
            signatario.celular,
            `simulado-${randomUUID()}`,
            `https://www.autentique.com.br/simulado/${randomUUID().slice(0, 8)}`,
          ],
        );
      }
      return { id: envioId };
    });
  }

  async reenviar(user: AuthUser, envioId: string) {
    const envio = await this.obterEnvio(envioId);
    if (!this.podeGerir(user, envio)) throw new ForbiddenException('Você não pode reenviar os avisos deste documento.');
    if (envio.status !== 'aguardando') throw new BadRequestException('Só é possível reenviar avisos de documentos aguardando assinatura.');
    if (!this.modoSimulado) throw new ServiceUnavailableException('O envio ao Autentique ainda não foi configurado.');
    const pendentes = await this.database.query(
      `SELECT id FROM autentique_signatarios WHERE envio_id = $1 AND status = 'pendente'`,
      [envioId],
    );
    return { reenviados: pendentes.rowCount ?? 0 };
  }

  async cancelar(user: AuthUser, envioId: string) {
    if (!isAdmin(user)) throw new ForbiddenException('Só um administrador pode cancelar o envio.');
    const envio = await this.obterEnvio(envioId);
    if (envio.status === 'cancelado') return { id: envio.id };
    await this.database.query(
      `UPDATE autentique_envios SET status = 'cancelado', cancelado_em = now(), cancelado_por_nome = $2 WHERE id = $1`,
      [envioId, user.username],
    );
    return { id: envio.id };
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
    const semCadastro = pessoas.filter(p => p.problema === 'sem_cadastro').map(p => p.nome);
    const semEmail = pessoas.filter(p => p.problema === 'sem_email').map(p => p.nome);
    const problemas = [
      semCadastro.length ? `Não encontrado no cadastro: ${semCadastro.join(', ')}.` : '',
      semEmail.length ? `Sem e-mail válido no cadastro: ${semEmail.join(', ')}.` : '',
    ].filter(Boolean);
    if (problemas.length) throw new BadRequestException(problemas.join(' '));
    return pessoas.map(({ ordem, funcoes, nome, email, celular }) => ({ ordem, funcoes, nome, email, celular }));
  }

  private async resolverSignatarios(
    participantes: ParticipanteEnvio[],
    chefeEquipe?: string,
  ): Promise<(SignatarioMontado & { problema: 'sem_cadastro' | 'sem_email' | null })[]> {
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

    let ordem = 0;
    return [...pessoas].map(([chave, pessoa]) => {
      ordem += 1;
      const dados = porNome.get(chave);
      const email = dados?.email ?? '';
      const problema = !dados ? 'sem_cadastro' as const
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'sem_email' as const
          : null;
      return { ordem, funcoes: pessoa.funcoes, nome: pessoa.nome, email, celular: dados?.celular ?? '', problema };
    });
  }
}
