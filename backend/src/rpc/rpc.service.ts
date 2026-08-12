import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
  constructor(private readonly database: DatabaseService) {}

  async call(name: string, params: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'verificar_senha':
        return this.verificarSenha(String(params.p_username ?? ''), String(params.p_password ?? ''));
      case 'criar_usuario_com_hash':
        return this.criarUsuarioComHash(params);
      case 'atualizar_senha':
        return this.atualizarSenha(String(params.p_username ?? ''), String(params.p_password ?? ''));
      case 'aprovar_escala_ferias_transacional':
        return this.aprovarEscalaFeriasTransacional(params);
      default:
        throw new NotFoundException(`RPC not exposed: ${name}`);
    }
  }

  private async verificarSenha(username: string, password: string): Promise<Record<string, unknown> | null> {
    if (!username || !password) return null;
    const result = await this.database.query<UsuarioRow>('SELECT * FROM usuarios WHERE username = $1 LIMIT 1', [username]);
    const user = result.rows[0];
    if (!user) return null;

    if (user.senha_hash) {
      const ok = await bcrypt.compare(password, user.senha_hash);
      return ok ? this.toUsuarioPayload(user) : null;
    }

    if (user.password && user.password === password) {
      const senhaHash = await bcrypt.hash(password, 12);
      const migrated = await this.database.query<UsuarioRow>(
        `UPDATE usuarios
         SET senha_hash = $1, password = '', updated_at = now()
         WHERE username = $2
         RETURNING *`,
        [senhaHash, username],
      );
      return this.toUsuarioPayload(migrated.rows[0] ?? user);
    }

    return null;
  }

  private async criarUsuarioComHash(params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const username = String(params.p_username ?? '').trim();
    const name = String(params.p_name ?? '').trim();
    const password = String(params.p_password ?? '');
    const role = String(params.p_role ?? 'bombeiro');

    if (!username || !name || !password) {
      throw new BadRequestException('username, name and password are required');
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

    return this.toUsuarioPayload(result.rows[0]);
  }

  private async atualizarSenha(username: string, password: string): Promise<boolean> {
    if (!username || !password) return false;
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

  private toUsuarioPayload(user: UsuarioRow): Record<string, unknown> {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      previousRole: user.previous_role ?? undefined,
      personId: user.person_id ?? undefined,
      personType: user.person_type ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
