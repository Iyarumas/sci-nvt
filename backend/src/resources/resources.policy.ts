import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser, isAdmin, VALID_ROLES } from '../auth/auth.types';

export type ResourceAction = 'query' | 'insert' | 'update' | 'delete';

interface PolicyDto {
  select?: string;
  filters?: { column: string; operator: string; value?: unknown }[];
  or?: string[];
  orders?: { column: string }[];
  payload?: Record<string, unknown> | Record<string, unknown>[];
}

/** Colunas que nunca saem da API nem podem ser filtradas/gravadas pelo CRUD generico. */
const SENSITIVE_USER_COLUMNS = ['password', 'senha_hash'];

/** Tabelas que so administradores podem ler ou alterar. */
const ADMIN_ONLY_TABLES = new Set(['convites']);

/** Campos que o proprio usuario pode alterar no seu cadastro (tela Perfil). */
const SELF_EDITABLE_USER_COLUMNS = new Set(['name', 'person_id', 'person_type', 'updated_at']);

function mentionsSensitive(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SENSITIVE_USER_COLUMNS.some((column) => lower.includes(column));
}

function payloadRows(dto: PolicyDto): Record<string, unknown>[] {
  if (Array.isArray(dto.payload)) return dto.payload;
  return dto.payload ? [dto.payload] : [];
}

/**
 * Regras de acesso do CRUD generico (/api/data/:table).
 * Pode ajustar o dto (ex.: remover campos que o usuario comum nao pode mudar).
 */
export function authorizeResource(user: AuthUser | undefined, table: string, action: ResourceAction, dto: PolicyDto): void {
  if (!user) throw new ForbiddenException('Autenticação necessária.');

  if (user.role === 'sem_funcao') {
    throw new ForbiddenException('Seu usuário ainda aguarda a atribuição de uma função.');
  }

  if (ADMIN_ONLY_TABLES.has(table) && !isAdmin(user)) {
    throw new ForbiddenException('Apenas administradores podem acessar este recurso.');
  }

  if (table === 'usuarios') authorizeUsuarios(user, action, dto);
}

function authorizeUsuarios(user: AuthUser, action: ResourceAction, dto: PolicyDto): void {
  const touchesSensitive =
    mentionsSensitive(dto.select) ||
    (dto.filters ?? []).some((filter) => mentionsSensitive(filter.column)) ||
    (dto.orders ?? []).some((order) => mentionsSensitive(order.column)) ||
    (dto.or ?? []).some((expression) => mentionsSensitive(expression)) ||
    payloadRows(dto).some((row) => Object.keys(row).some((key) => mentionsSensitive(key)));
  if (touchesSensitive) {
    throw new BadRequestException('Senhas só podem ser alteradas pela tela de senha.');
  }

  for (const row of payloadRows(dto)) {
    if (row.role !== undefined && !VALID_ROLES.has(String(row.role))) {
      throw new BadRequestException('Função inválida.');
    }
    if (row.role === 'desenvolvedor' && user.role !== 'desenvolvedor') {
      throw new ForbiddenException('Apenas o desenvolvedor pode atribuir a função Desenvolvedor.');
    }
  }

  if (action === 'query') return;

  if (isAdmin(user)) return;

  if (action !== 'update') {
    throw new ForbiddenException('Apenas administradores podem criar ou excluir usuários.');
  }

  // Usuario comum: so pode editar o proprio cadastro e apenas campos basicos.
  const filters = dto.filters ?? [];
  const targetsOnlySelf =
    filters.length > 0 &&
    !(dto.or && dto.or.length) &&
    filters.every(
      (filter) =>
        filter.operator === 'eq' &&
        ((filter.column === 'username' && filter.value === user.username) ||
          (filter.column === 'id' && filter.value === user.id)),
    );
  if (!targetsOnlySelf) {
    throw new ForbiddenException('Você só pode alterar o seu próprio cadastro.');
  }

  const payload = dto.payload as Record<string, unknown>;
  for (const key of Object.keys(payload)) {
    if (!SELF_EDITABLE_USER_COLUMNS.has(key)) delete payload[key];
  }
  if (!Object.keys(payload).length) payload.updated_at = new Date().toISOString();
}

/** Remove colunas de senha de qualquer resposta da tabela usuarios. */
export function sanitizeResourceResult<T extends { data: unknown }>(table: string, result: T): T {
  if (table !== 'usuarios' || !result.data) return result;
  const strip = (row: unknown) => {
    if (row && typeof row === 'object') {
      for (const column of SENSITIVE_USER_COLUMNS) delete (row as Record<string, unknown>)[column];
    }
    return row;
  };
  if (Array.isArray(result.data)) result.data.forEach(strip);
  else strip(result.data);
  return result;
}
