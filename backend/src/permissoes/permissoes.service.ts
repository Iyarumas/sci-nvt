import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser, isAdmin } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ACOES_VALIDAS, ALCANCES, Alcance, FUNCOES, Funcao, PADRAO, TELAS } from './permissoes.padrao';

export interface CelulaFuncao {
  alcance: Alcance;
  padrao: Alcance;
  observacao: string | null;
  alteradoPor: string | null;
  alteradoEm: string | null;
}

export interface UsuarioPermissao {
  id: string;
  username: string;
  nome: string;
  papel: string;
  /** Cargo do cadastro do bombeiro ligado ao usuário (null = sem função na grade). */
  funcao: Funcao | null;
  equipe: string | null;
  acessoTotal: boolean;
}

export interface ExcecaoUsuario {
  usuarioId: string;
  acao: string;
  alcance: Alcance;
  alteradoPor: string;
  alteradoEm: string;
}

export interface MudancaFuncao { funcao: string; acao: string; alcance: string }
export interface MudancaUsuario { usuarioId: string; acao: string; alcance: string | null }

const ehFuncao = (valor: unknown): valor is Funcao => (FUNCOES as readonly string[]).includes(String(valor));
const ehAlcance = (valor: unknown): valor is Alcance => (ALCANCES as readonly string[]).includes(String(valor));

@Injectable()
export class PermissoesService {
  constructor(private readonly database: DatabaseService) {}

  private async gradeFuncoes() {
    const salvas = await this.database.query<{ funcao: string; acao: string; alcance: Alcance; atualizado_por: string; atualizado_em: Date }>(
      'SELECT funcao, acao, alcance, atualizado_por, atualizado_em FROM permissao_funcao',
    );
    const porChave = new Map(salvas.rows.map(row => [`${row.funcao}|${row.acao}`, row]));
    const grade: Record<string, Record<string, CelulaFuncao>> = {};
    for (const acao of Object.keys(PADRAO)) {
      grade[acao] = {};
      for (const funcao of FUNCOES) {
        const padrao = PADRAO[acao][funcao];
        const salva = porChave.get(`${funcao}|${acao}`);
        grade[acao][funcao] = {
          alcance: salva?.alcance ?? padrao.alcance,
          padrao: padrao.alcance,
          observacao: padrao.observacao ?? null,
          alteradoPor: salva?.atualizado_por ?? null,
          alteradoEm: salva ? salva.atualizado_em.toISOString() : null,
        };
      }
    }
    return grade;
  }

  private async usuarios(): Promise<UsuarioPermissao[]> {
    const r = await this.database.query<{
      id: string; username: string; name: string | null; role: string; cargo: string | null; equipe: string | null; nome_completo: string | null;
    }>(
      `SELECT u.id, u.username, u.name, u.role, b.cargo, b.equipe, b.nome_completo
         FROM usuarios u
         LEFT JOIN bombeiros b ON u.person_type = 'bombeiro' AND b.id::text = u.person_id::text
        WHERE u.role <> 'sem_funcao'
        ORDER BY coalesce(b.nome_completo, u.name, u.username)`,
    );
    return r.rows.map(row => ({
      id: String(row.id),
      username: row.username,
      nome: row.nome_completo || row.name || row.username,
      papel: row.role,
      funcao: ehFuncao(row.cargo) ? row.cargo : null,
      equipe: row.equipe,
      acessoTotal: row.role === 'admin' || row.role === 'desenvolvedor',
    }));
  }

  private async excecoes(): Promise<ExcecaoUsuario[]> {
    const r = await this.database.query<{ usuario_id: string; acao: string; alcance: Alcance; atualizado_por: string; atualizado_em: Date }>(
      'SELECT usuario_id, acao, alcance, atualizado_por, atualizado_em FROM permissao_usuario ORDER BY atualizado_em DESC',
    );
    return r.rows
      .filter(row => ACOES_VALIDAS.has(row.acao))
      .map(row => ({
        usuarioId: row.usuario_id, acao: row.acao, alcance: row.alcance,
        alteradoPor: row.atualizado_por, alteradoEm: row.atualizado_em.toISOString(),
      }));
  }

  /** Tudo o que a tela Permissões precisa (só administrador). */
  async listar(user: AuthUser) {
    if (!isAdmin(user)) throw new ForbiddenException('Só administradores veem as permissões.');
    const [grade, usuarios, excecoes] = await Promise.all([this.gradeFuncoes(), this.usuarios(), this.excecoes()]);
    return { funcoes: FUNCOES, alcances: ALCANCES, telas: TELAS, grade, usuarios, excecoes };
  }

  /** O que o usuário logado pode fazer em cada ação (para as telas na próxima etapa). */
  async minhas(user: AuthUser): Promise<{ acessoTotal: boolean; funcao: Funcao | null; equipe: string | null; acoes: Record<string, Alcance> }> {
    if (isAdmin(user)) {
      return { acessoTotal: true, funcao: null, equipe: null, acoes: Object.fromEntries(Object.keys(PADRAO).map(a => [a, 'todas' as Alcance])) };
    }
    const eu = (await this.usuarios()).find(u => u.id === String(user.id));
    const grade = await this.gradeFuncoes();
    const excecoes = (await this.excecoes()).filter(e => e.usuarioId === String(user.id));
    const acoes: Record<string, Alcance> = {};
    for (const acao of Object.keys(PADRAO)) {
      acoes[acao] = eu?.funcao ? grade[acao][eu.funcao].alcance : 'nao';
    }
    for (const e of excecoes) acoes[e.acao] = e.alcance;
    return { acessoTotal: false, funcao: eu?.funcao ?? null, equipe: eu?.equipe ?? null, acoes };
  }

  async salvar(user: AuthUser, funcoes: MudancaFuncao[], usuarios: MudancaUsuario[]) {
    if (!isAdmin(user)) throw new ForbiddenException('Só administradores podem alterar as permissões.');
    if ((!Array.isArray(funcoes) || !funcoes.length) && (!Array.isArray(usuarios) || !usuarios.length)) {
      throw new BadRequestException('Nenhuma alteração enviada.');
    }
    for (const m of funcoes ?? []) {
      if (!ehFuncao(m.funcao) || !ACOES_VALIDAS.has(m.acao) || !ehAlcance(m.alcance)) throw new BadRequestException('Permissão inválida.');
    }
    const idsUsuarios = new Set((await this.usuarios()).map(u => u.id));
    for (const m of usuarios ?? []) {
      if (!idsUsuarios.has(String(m.usuarioId)) || !ACOES_VALIDAS.has(m.acao) || (m.alcance !== null && !ehAlcance(m.alcance))) {
        throw new BadRequestException('Exceção inválida.');
      }
    }
    await this.database.transaction(async client => {
      for (const m of funcoes ?? []) {
        // Voltar ao padrão apaga a alteração, para o padrão do código continuar valendo.
        if (PADRAO[m.acao][m.funcao as Funcao].alcance === m.alcance) {
          await client.query('DELETE FROM permissao_funcao WHERE funcao = $1 AND acao = $2', [m.funcao, m.acao]);
          continue;
        }
        await client.query(
          `INSERT INTO permissao_funcao (funcao, acao, alcance, atualizado_por, atualizado_em) VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (funcao, acao) DO UPDATE SET alcance = EXCLUDED.alcance, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
          [m.funcao, m.acao, m.alcance, user.username],
        );
      }
      for (const m of usuarios ?? []) {
        if (m.alcance === null) {
          await client.query('DELETE FROM permissao_usuario WHERE usuario_id = $1 AND acao = $2', [String(m.usuarioId), m.acao]);
          continue;
        }
        await client.query(
          `INSERT INTO permissao_usuario (usuario_id, acao, alcance, atualizado_por, atualizado_em) VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (usuario_id, acao) DO UPDATE SET alcance = EXCLUDED.alcance, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
          [String(m.usuarioId), m.acao, m.alcance, user.username],
        );
      }
    });
    return this.listar(user);
  }
}
