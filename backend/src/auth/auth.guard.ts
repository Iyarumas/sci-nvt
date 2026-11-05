import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ALLOW_PENDING_KEY, IS_PUBLIC_KEY, isComunicante } from './auth.types';

/**
 * O comunicante (OC) lê o que as telas da central precisam, mas só grava o início e
 * o fim de plantão, ocorrências, inspeções e solicitações, a própria senha e o perfil.
 */
function acaoPermitidaAoComunicante(request: Request): boolean {
  if (request.method === 'GET') return true;
  // Tira o prefixo global da API (API_PREFIX, "api" por padrão).
  const caminho = request.path.replace(/^\/[^/]+(?=\/)/, '');
  if (/^\/data\/[^/]+\/query$/.test(caminho)) return true;
  if ((caminho === '/inicio-plantao' || caminho === '/fim-plantao') && request.method === 'PUT') return true;
  // Registros que o comunicante lança: ocorrências do LRO, inspeções e solicitações.
  // A tela limita a edição e a exclusão ao que ele mesmo lançou.
  if (/^\/data\/(ocorrencias_operacionais|conferencias)\/(insert|update|delete)$/.test(caminho)) return true;
  if (caminho === '/rpc/verificar_senha' || caminho === '/rpc/atualizar_senha') return true;
  // Perfil: a política do CRUD já limita o usuário comum ao próprio cadastro.
  if (caminho === '/data/usuarios/update') return true;
  return false;
}

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
        if (isComunicante(user) && !acaoPermitidaAoComunicante(request)) {
          throw new ForbiddenException('O comunicante só pode lançar os registros da central.');
        }
        return true;
      }
      if (!isPublic) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    if (isPublic) return true;
    throw new UnauthorizedException('Autenticação necessária.');
  }
}
