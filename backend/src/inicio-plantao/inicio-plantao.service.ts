import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { QueryResultRow } from 'pg';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

/** O link do QR Code vale até o fim do plantão seguinte. */
const VALIDADE_LINK_HORAS = 36;
const MAX_MENSAGEM = 8000;

/** Início e fim de plantão têm o mesmo formato; muda só a tabela. */
export type TipoPlantao = 'inicio' | 'fim';
const TABELA: Record<TipoPlantao, string> = { inicio: 'inicio_plantao', fim: 'fim_plantao' };

interface PlantaoRow extends QueryResultRow {
  id: string;
  data: string;
  equipe: string;
  dados: Record<string, unknown>;
  mensagem: string;
  token_publico: string;
  token_expira_em: Date;
  criado_por: string;
  atualizado_por: string;
  updated_at: Date;
}

function paraResposta(row: PlantaoRow) {
  return {
    id: row.id,
    data: row.data,
    equipe: row.equipe,
    dados: row.dados,
    mensagem: row.mensagem,
    token: row.token_publico,
    tokenExpiraEm: row.token_expira_em.toISOString(),
    criadoPor: row.criado_por,
    atualizadoPor: row.atualizado_por,
    atualizadoEm: row.updated_at.toISOString(),
  };
}

@Injectable()
export class InicioPlantaoService {
  constructor(private readonly database: DatabaseService) {}

  private validarChave(data: string, equipe: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new BadRequestException('Data inválida.');
    if (!equipe || equipe.length > 40) throw new BadRequestException('Equipe inválida.');
  }

  async obter(tipo: TipoPlantao, data: string, equipe: string) {
    this.validarChave(data, equipe);
    const result = await this.database.query<PlantaoRow>(
      `SELECT * FROM ${TABELA[tipo]} WHERE data = $1 AND equipe = $2`,
      [data, equipe],
    );
    return result.rows[0] ? paraResposta(result.rows[0]) : null;
  }

  /** O último registro antes da data: sugere o que costuma se repetir de um plantão para o outro. */
  async anterior(tipo: TipoPlantao, data: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new BadRequestException('Data inválida.');
    const result = await this.database.query<PlantaoRow>(
      `SELECT * FROM ${TABELA[tipo]} WHERE data < $1 ORDER BY data DESC, updated_at DESC LIMIT 1`,
      [data],
    );
    return result.rows[0] ? paraResposta(result.rows[0]) : null;
  }

  async salvar(tipo: TipoPlantao, user: AuthUser, input: { data?: string; equipe?: string; dados?: unknown; mensagem?: string }) {
    const data = String(input.data ?? '');
    const equipe = String(input.equipe ?? '');
    this.validarChave(data, equipe);
    if (!input.dados || typeof input.dados !== 'object') throw new BadRequestException('Informações do plantão inválidas.');
    const mensagem = String(input.mensagem ?? '');
    if (!mensagem.trim() || mensagem.length > MAX_MENSAGEM) throw new BadRequestException('Mensagem inválida.');

    const expira = new Date(Date.now() + VALIDADE_LINK_HORAS * 3600 * 1000);
    const result = await this.database.query<PlantaoRow>(
      `INSERT INTO ${TABELA[tipo]} (data, equipe, dados, mensagem, token_publico, token_expira_em, criado_por, atualizado_por)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $7)
       ON CONFLICT (data, equipe) DO UPDATE SET
         dados = EXCLUDED.dados,
         mensagem = EXCLUDED.mensagem,
         token_expira_em = EXCLUDED.token_expira_em,
         atualizado_por = EXCLUDED.atualizado_por,
         updated_at = now()
       RETURNING *`,
      [data, equipe, JSON.stringify(input.dados), mensagem, randomBytes(16).toString('hex'), expira, user.username],
    );
    return paraResposta(result.rows[0]);
  }

  /** Só o texto da mensagem, para o link do QR Code. Procura no início e no fim de plantão. Expira. */
  async mensagemPublica(token: string) {
    if (!/^[0-9a-f]{32}$/.test(token)) throw new NotFoundException('Mensagem não encontrada.');
    for (const tipo of Object.keys(TABELA) as TipoPlantao[]) {
      const result = await this.database.query<{ data: string; equipe: string; mensagem: string; token_expira_em: Date }>(
        `SELECT data, equipe, mensagem, token_expira_em FROM ${TABELA[tipo]} WHERE token_publico = $1`,
        [token],
      );
      const row = result.rows[0];
      if (!row) continue;
      if (row.token_expira_em.getTime() < Date.now()) {
        throw new NotFoundException('Este link expirou. Gere o QR Code de novo no sistema.');
      }
      return { tipo, data: row.data, equipe: row.equipe, mensagem: row.mensagem };
    }
    throw new NotFoundException('Mensagem não encontrada.');
  }
}
