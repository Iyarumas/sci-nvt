import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthUser, UserRole, VALID_ROLES } from './auth.types';
import { hmac, safeEqual, signToken, verifyToken } from './token.util';

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

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 horas
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;
const USER_CACHE_MS = 15 * 1000;
const FILE_LINK_TTL_SECONDS = 60 * 60;

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret: string;
  private readonly failedAttempts = new Map<string, { count: number; firstAt: number }>();
  private readonly userCache = new Map<string, { user: AuthUser | null; at: number }>();
  private readonly dummyHash = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    const configured = config.get<string>('JWT_SECRET')?.trim();
    if (configured && configured.length >= 32) {
      this.secret = configured;
    } else {
      // Sem segredo configurado o sistema continua funcionando, mas todos precisam
      // entrar de novo sempre que a API reiniciar. Configure JWT_SECRET no .env.
      this.secret = randomBytes(48).toString('hex');
      this.logger.warn(
        'JWT_SECRET ausente ou curto (minimo 32 caracteres). Usando segredo temporario: as sessoes expiram a cada reinicio da API.',
      );
    }
  }

  /** Avisa no log se ainda existir a conta antiga com senha padrao (serra/serra). */
  async onApplicationBootstrap(): Promise<void> {
    try {
      if (await this.checkPassword('serra', 'serra')) {
        this.logger.warn('ATENCAO: o usuario "serra" ainda usa a senha padrao "serra". Troque essa senha imediatamente.');
      }
    } catch {
      /* banco indisponivel na subida: ignora */
    }
  }

  // ---------------------------------------------------------------- login

  async login(usernameRaw: string, password: string, ip: string) {
    const username = (usernameRaw ?? '').trim();
    if (!username || !password) throw new UnauthorizedException('Usuário ou senha inválidos.');

    const key = `${username.toLowerCase()}|${ip}`;
    this.assertNotBlocked(key);

    const user = await this.checkPassword(username, password);
    if (!user) {
      const remaining = this.registerFailure(key);
      const msg = remaining <= 0
        ? 'Usuário ou senha inválidos. Conta bloqueada por 15 minutos.'
        : `Usuário ou senha inválidos. ${remaining} tentativa(s) restante(s).`;
      throw new UnauthorizedException(msg);
    }

    this.failedAttempts.delete(key);
    return this.issueSession(user);
  }

  async me(authUser: AuthUser) {
    const result = await this.database.query<UsuarioRow>('SELECT * FROM usuarios WHERE id = $1 LIMIT 1', [authUser.id]);
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException('Sessão inválida.');
    return { user: this.toPayload(row) };
  }

  /** Confere a senha sem abrir sessao (usado no RPC verificar_senha). */
  async checkPassword(username: string, password: string): Promise<UsuarioRow | null> {
    if (!username || !password) return null;
    const result = await this.database.query<UsuarioRow>('SELECT * FROM usuarios WHERE username = $1 LIMIT 1', [username]);
    const user = result.rows[0];
    if (!user) {
      // Mantem o tempo de resposta parecido para nao revelar se o usuario existe.
      await bcrypt.compare(password, this.dummyHash);
      return null;
    }

    if (user.senha_hash) {
      return (await bcrypt.compare(password, user.senha_hash)) ? user : null;
    }

    // Migracao de senhas antigas em texto puro para hash.
    if (user.password && safeEqual(user.password, password)) {
      const senhaHash = await bcrypt.hash(password, 12);
      const migrated = await this.database.query<UsuarioRow>(
        `UPDATE usuarios SET senha_hash = $1, password = '', updated_at = now() WHERE id = $2 RETURNING *`,
        [senhaHash, user.id],
      );
      return migrated.rows[0] ?? user;
    }
    return null;
  }

  // ------------------------------------------------------------- convites

  async checkConvite(codigoRaw: string) {
    const codigo = (codigoRaw ?? '').trim().toUpperCase();
    const convite = await this.findValidConvite(codigo);
    return { valido: !!convite, expiresAt: convite?.expires_at ?? null };
  }

  async registerWithConvite(body: { codigo?: string; username?: string; name?: string; password?: string }, ip: string) {
    const codigo = String(body.codigo ?? '').trim().toUpperCase();
    const username = String(body.username ?? '').trim();
    const name = String(body.name ?? username).trim();
    const password = String(body.password ?? '');

    if (!codigo || !username || !password) throw new BadRequestException('Código, usuário e senha são obrigatórios.');
    if (!/^[a-zA-Z0-9._@-]{3,60}$/.test(username)) {
      throw new BadRequestException('Usuário deve ter de 3 a 60 caracteres (letras, números, ponto, hífen ou @).');
    }
    if (password.length < 6) throw new BadRequestException('A senha deve ter pelo menos 6 caracteres.');

    const key = `convite|${ip}`;
    this.assertNotBlocked(key);

    const created = await this.database.transaction(async (client) => {
      const convite = await client.query<{ id: string; usado: boolean; expires_at: string | null; created_at: string }>(
        'SELECT id, usado, expires_at, created_at FROM convites WHERE codigo = $1 FOR UPDATE',
        [codigo],
      );
      const row = convite.rows[0];
      if (!row || row.usado || this.isExpired(row.expires_at, row.created_at)) {
        this.registerFailure(key);
        throw new BadRequestException('Convite inválido ou expirado.');
      }

      const exists = await client.query('SELECT 1 FROM usuarios WHERE lower(username) = lower($1) LIMIT 1', [username]);
      if (exists.rowCount) throw new ConflictException('Nome de usuário já existe.');

      const senhaHash = await bcrypt.hash(password, 12);
      const inserted = await client.query<UsuarioRow>(
        `INSERT INTO usuarios (username, name, password, role, senha_hash, created_at, updated_at)
         VALUES ($1, $2, '', 'sem_funcao', $3, now(), now())
         RETURNING *`,
        [username, name || username, senhaHash],
      );
      await client.query(
        'UPDATE convites SET usado = true, usado_em = now(), registrado_por = $1 WHERE id = $2',
        [username, row.id],
      );
      return inserted.rows[0];
    });

    return { user: this.toPayload(created) };
  }

  // -------------------------------------------------------------- tokens

  async resolveToken(token: string): Promise<AuthUser | null> {
    const payload = verifyToken<{ sub: string }>(token, this.secret);
    if (!payload?.sub) return null;
    return this.loadUser(payload.sub);
  }

  /** Busca o papel atual no banco (com cache curto) para que mudancas de papel valham na hora. */
  async loadUser(id: string): Promise<AuthUser | null> {
    const cached = this.userCache.get(id);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.user;
    const result = await this.database.query<{ id: string; username: string; role: string }>(
      'SELECT id, username, role FROM usuarios WHERE id = $1 LIMIT 1',
      [id],
    );
    const row = result.rows[0];
    const user = row
      ? { id: row.id, username: row.username, role: (VALID_ROLES.has(row.role) ? row.role : 'sem_funcao') as UserRole }
      : null;
    this.userCache.set(id, { user, at: Date.now() });
    return user;
  }

  invalidateUserCache(): void {
    this.userCache.clear();
  }

  /** Link temporario para abrir um arquivo do storage sem cabecalho (iframe, nova aba). */
  signFileLink(bucket: string, path: string): { exp: string; sig: string } {
    const exp = String(Math.floor(Date.now() / 1000) + FILE_LINK_TTL_SECONDS);
    return { exp, sig: hmac(this.secret, `file|${bucket}|${path}|${exp}`) };
  }

  verifyFileLink(bucket: string, path: string, exp?: string, sig?: string): boolean {
    if (!exp || !sig || !/^\d+$/.test(exp)) return false;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
    return safeEqual(sig, hmac(this.secret, `file|${bucket}|${path}|${exp}`));
  }

  toPayload(user: UsuarioRow): Record<string, unknown> {
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

  // ------------------------------------------------------------- helpers

  private issueSession(user: UsuarioRow) {
    const token = signToken({ sub: user.id, username: user.username }, this.secret, TOKEN_TTL_SECONDS);
    return {
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
      user: this.toPayload(user),
    };
  }

  private async findValidConvite(codigo: string) {
    if (!codigo) return null;
    const result = await this.database.query<{ usado: boolean; expires_at: string | null; created_at: string }>(
      'SELECT usado, expires_at, created_at FROM convites WHERE codigo = $1 LIMIT 1',
      [codigo],
    );
    const row = result.rows[0];
    if (!row || row.usado || this.isExpired(row.expires_at, row.created_at)) return null;
    return row;
  }

  private isExpired(expiresAt: string | null, createdAt: string): boolean {
    const limit = expiresAt ? new Date(expiresAt).getTime() : new Date(createdAt).getTime() + 2 * 60 * 60 * 1000;
    return limit < Date.now();
  }

  private assertNotBlocked(key: string): void {
    const entry = this.failedAttempts.get(key);
    if (!entry) return;
    const elapsed = Date.now() - entry.firstAt;
    if (elapsed > BLOCK_MS) {
      this.failedAttempts.delete(key);
      return;
    }
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      const minutes = Math.ceil((BLOCK_MS - elapsed) / 60000);
      throw new HttpException(
        `Muitas tentativas inválidas. Tente novamente em ${minutes} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(key: string): number {
    const now = Date.now();
    const entry = this.failedAttempts.get(key);
    if (!entry || now - entry.firstAt > BLOCK_MS) {
      this.failedAttempts.set(key, { count: 1, firstAt: now });
      return MAX_FAILED_ATTEMPTS - 1;
    }
    entry.count += 1;
    return MAX_FAILED_ATTEMPTS - entry.count;
  }
}
