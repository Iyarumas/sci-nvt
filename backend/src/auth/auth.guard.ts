import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ALLOW_PENDING_KEY, IS_PUBLIC_KEY } from './auth.types';

export function extractBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

/**
 * Guarda global: toda rota da API exige token valido, exceto as marcadas com @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = extractBearer(request);
    if (token) {
      const user = await this.auth.resolveToken(token);
      if (user) {
        if (user.role === 'sem_funcao' && !allowPending) {
          if (isPublic) return true;
          throw new ForbiddenException('Seu usuário ainda aguarda a atribuição de uma função.');
        }
        request.authUser = user;
        return true;
      }
      if (!isPublic) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    if (isPublic) return true;
    throw new UnauthorizedException('Autenticação necessária.');
  }
}
