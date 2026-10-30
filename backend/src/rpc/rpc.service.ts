import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { AuthUser, isAdmin, VALID_ROLES } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

interface UsuarioRow {
  id: string;
  username: string;
  name: string;
  password?: string | null;
  senha_hash?: string | null;
  role: string;
  previous_role?: string | null;
  person_id?: string | null;
  person_type?: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class RpcService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  async call(name: string, params: Record<string, unknown>, user: AuthUser): Promise<unknown> {
    switch (name) {
      case 'verificar_senha':
        return this.verificarSenha(user, String(params.p_username ?? ''), String(params.p_password ?? ''));
      case 'criar_usuario_com_hash':
        return this.criarUsuarioComHash(user, params);
      case 'atualizar_senha':
        return this.atualizarSenha(user, String(params.p_username ?? ''), String(params.p_password ?? ''));
      case 'aprovar_escala_ferias_transacional':
        if (user.role === 'sem_funcao') throw new ForbiddenException('Seu usuário ainda aguarda a atribuição de uma função.');
        return this.aprovarEscalaFeriasTransacional(params);
      default:
        throw new NotFoundException(`RPC not exposed: ${name}`);
    }
  }

  /** So confere a senha do proprio usuario (ex.: confirmar senha atual no Perfil). O login usa /auth/login. */
  private async verificarSenha(user: AuthUser, username: string, password: string): Promise<Record<string, unknown> | null> {
    if (username !== user.username) {
      throw new ForbiddenException('Você só pode confirmar a sua própria senha.');
    }
    const row = await this.auth.checkPassword(username, password);
    return row ? this.auth.toPayload(row) : null;
  }

  private async criarUsuarioComHash(user: AuthUser, params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Apenas administradores podem criar usuários.');
    }
    const username = String(params.p_username ?? '').trim();
    const name = String(params.p_name ?? '').trim();
    const password = String(params.p_password ?? '');
    const role = String(params.p_role ?? 'bombeiro');

    if (!username || !name || !password) {
      throw new BadRequestException('username, name and password are required');
    }
    if (!VALID_ROLES.has(role)) {
      throw new BadRequestException('Função inválida.');
    }
    if (role === 'desenvolvedor' && user.role !== 'desenvolvedor') {
      throw new ForbiddenException('Apenas o desenvolvedor pode criar outro desenvolvedor.');
    }
    const exists = await this.database.query('SELECT 1 FROM usuarios WHERE lower(username) = lower($1) LIMIT 1', [username]);
    if (exists.rowCount) {
      throw new ConflictException('Nome de usuário já existe.');
    }

    const senhaHash = await bcrypt.hash(password, 12);
    const result = await this.database.query<UsuarioRow>(
      `INSERT INTO usuarios
        (username, name, password, role, previous_role, person_id, person_type, senha_hash, created_at, updated_at)
       VALUES ($1, $2, '', $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [
        username,
        name,
        role,
        params.p_previous_role ?? null,
        params.p_person_id ?? null,
        params.p_person_type ?? null,
        senhaHash,
      ],
    );

    this.auth.invalidateUserCache();
    return this.auth.toPayload(result.rows[0]);
  }

  private async atualizarSenha(user: AuthUser, username: string, password: string): Promise<boolean> {
    if (!username || !password) return false;
    if (username !== user.username && !isAdmin(user)) {
      throw new ForbiddenException('Você só pode alterar a sua própria senha.');
    }
    if (password.length < 6) {
      throw new BadRequestException('A senha deve ter pelo menos 6 caracteres.');
    }
    if (username !== user.username && user.role !== 'desenvolvedor') {
      const target = await this.database.query<{ role: string }>('SELECT role FROM usuarios WHERE username = $1 LIMIT 1', [username]);
      if (target.rows[0]?.role === 'desenvolvedor') {
        throw new ForbiddenException('Apenas o desenvolvedor pode alterar a senha de outro desenvolvedor.');
      }
    }
    const senhaHash = await bcrypt.hash(password, 12);
    const result = await this.database.query(
      `UPDATE usuarios SET senha_hash = $1, password = '', updated_at = now() WHERE username = $2`,
      [senhaHash, username],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async aprovarEscalaFeriasTransacional(params: Record<string, unknown>): Promise<unknown> {
    const result = await this.database.query(
      `SELECT public.aprovar_escala_ferias_transacional($1, $2, $3, $4) AS result`,
      [
        params.p_escala_id,
        params.p_aprovado_por,
        params.p_aprovado_por_nome,
        params.p_manter_status ?? false,
      ],
    );
    return result.rows[0]?.result ?? true;
  }
}
