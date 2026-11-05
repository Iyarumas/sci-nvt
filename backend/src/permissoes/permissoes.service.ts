import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser, isAdmin } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FUNCOES, MODULOS, NIVEIS, NivelPermissao, PADRAO } from './permissoes.padrao';

export interface CelulaPermissao {
  nivel: NivelPermissao;
  padrao: NivelPermissao;
  observacao: string | null;
  alteradoPor: string | null;
  alteradoEm: string | null;
}

export interface AlteracaoPermissao {
  funcao: string;
  modulo: string;
  nivel: string;
}

@Injectable()
export class PermissoesService {
  constructor(private readonly database: DatabaseService) {}

  /** A grade completa: padrão do código com as alterações do administrador por cima. */
  async listar() {
    const salvas = await this.database.query<{ funcao: string; modulo: string; nivel: NivelPermissao; atualizado_por: string; atualizado_em: Date }>(
      'SELECT funcao, modulo, nivel, atualizado_por, atualizado_em FROM permissoes_funcao',
    );
    const porChave = new Map(salvas.rows.map(row => [`${row.funcao}|${row.modulo}`, row]));
    const grade: Record<string, Record<string, CelulaPermissao>> = {};
    for (const modulo of MODULOS) {
      grade[modulo.chave] = {};
      for (const funcao of FUNCOES) {
        const padrao = PADRAO[modulo.chave][funcao];
        const salva = porChave.get(`${funcao}|${modulo.chave}`);
        grade[modulo.chave][funcao] = {
          nivel: salva?.nivel ?? padrao.nivel,
          padrao: padrao.nivel,
          observacao: padrao.observacao ?? null,
          alteradoPor: salva?.atualizado_por ?? null,
          alteradoEm: salva ? salva.atualizado_em.toISOString() : null,
        };
      }
    }
    return { funcoes: FUNCOES, modulos: MODULOS, niveis: NIVEIS, grade };
  }

  async salvar(user: AuthUser, alteracoes: AlteracaoPermissao[]) {
    if (!isAdmin(user)) throw new ForbiddenException('Só administradores podem alterar as permissões.');
    if (!Array.isArray(alteracoes) || !alteracoes.length) throw new BadRequestException('Nenhuma alteração enviada.');
    for (const { funcao, modulo, nivel } of alteracoes) {
      const moduloInfo = MODULOS.find(item => item.chave === modulo);
      if (!(FUNCOES as readonly string[]).includes(funcao) || !moduloInfo || !(NIVEIS as readonly string[]).includes(nivel)) {
        throw new BadRequestException('Permissão inválida.');
      }
      if (nivel === 'equipe' && !moduloInfo.porEquipe) {
        throw new BadRequestException(`${moduloInfo.nome} não tem o nível "própria equipe".`);
      }
    }
    await this.database.transaction(async client => {
      for (const { funcao, modulo, nivel } of alteracoes) {
        // Voltar ao padrão apaga a alteração, para o padrão do código continuar valendo.
        if (PADRAO[modulo][funcao as (typeof FUNCOES)[number]].nivel === nivel) {
          await client.query('DELETE FROM permissoes_funcao WHERE funcao = $1 AND modulo = $2', [funcao, modulo]);
          continue;
        }
        await client.query(
          `INSERT INTO permissoes_funcao (funcao, modulo, nivel, atualizado_por, atualizado_em)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (funcao, modulo) DO UPDATE SET nivel = EXCLUDED.nivel, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
          [funcao, modulo, nivel, user.username],
        );
      }
    });
    return this.listar();
  }
}
