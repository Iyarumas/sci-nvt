import { SetMetadata } from '@nestjs/common';

export type UserRole = 'desenvolvedor' | 'admin' | 'gerente' | 'chefe' | 'lider' | 'bombeiro' | 'comunicante' | 'sem_funcao';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  /** Função no cadastro de bombeiros (BA-CE, OC...), quando o usuário está vinculado a um bombeiro. */
  funcao?: string | null;
}

/** Papeis que administram usuarios, convites e acessos. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['desenvolvedor', 'admin']);

export const VALID_ROLES: ReadonlySet<string> = new Set([
  'desenvolvedor', 'admin', 'gerente', 'chefe', 'lider', 'bombeiro', 'comunicante', 'sem_funcao',
]);

export function isAdmin(user: AuthUser | undefined): boolean {
  return !!user && ADMIN_ROLES.has(user.role);
}

/**
 * Comunicante: só as contas da Central (uma por equipe, permissão "Comunicante (OC)" em Usuários).
 * O bombeiro com função OC no cadastro e login próprio continua usando o sistema normal.
 */
export function isComunicante(user: AuthUser | undefined): boolean {
  return !!user && !isAdmin(user) && user.role === 'comunicante';
}

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Marca uma rota como acessivel sem token (login, convite, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ALLOW_PENDING_KEY = 'auth:allowPending';

/** Rotas que usuarios ainda sem funcao (sem_funcao) podem usar, como /auth/me. */
export const AllowPending = () => SetMetadata(ALLOW_PENDING_KEY, true);

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}
