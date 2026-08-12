import { BadRequestException } from '@nestjs/common';

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';

export interface ResourceFilter {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  values?: unknown[];
}

export interface ResourceOrder {
  column: string;
  ascending?: boolean;
}

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertIdentifier(identifier: string): string {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new BadRequestException(`Invalid SQL identifier: ${identifier}`);
  }
  return identifier;
}

export function quoteIdentifier(identifier: string): string {
  return `"${assertIdentifier(identifier)}"`;
}

export function selectClause(selection?: string): string {
  if (!selection || selection.trim() === '*' || selection.trim() === '') return '*';
  return selection
    .split(',')
    .map((column) => quoteIdentifier(column.trim()))
    .join(', ');
}

export function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function normalizeNullish(value: unknown): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export function buildFilterSql(filter: ResourceFilter, params: unknown[]): string {
  const column = quoteIdentifier(filter.column);
  const value = normalizeNullish(filter.value);

  switch (filter.operator) {
    case 'eq':
      return `${column} = ${pushParam(params, value)}`;
    case 'neq':
      return `${column} <> ${pushParam(params, value)}`;
    case 'gt':
      return `${column} > ${pushParam(params, value)}`;
    case 'gte':
      return `${column} >= ${pushParam(params, value)}`;
    case 'lt':
      return `${column} < ${pushParam(params, value)}`;
    case 'lte':
      return `${column} <= ${pushParam(params, value)}`;
    case 'ilike':
      return `${column} ILIKE ${pushParam(params, value)}`;
    case 'like':
      return `${column} LIKE ${pushParam(params, value)}`;
    case 'is':
      if (value === null || value === undefined || value === '') return `${column} IS NULL`;
      if (value === 'not.null') return `${column} IS NOT NULL`;
      if (typeof value === 'boolean') return `${column} IS ${value ? 'TRUE' : 'FALSE'}`;
      throw new BadRequestException(`Unsupported IS value for ${filter.column}`);
    case 'in': {
      const values = filter.values ?? (Array.isArray(value) ? value : []);
      if (!values.length) return 'FALSE';
      return `${column} IN (${values.map((item) => pushParam(params, item)).join(', ')})`;
    }
    default:
      throw new BadRequestException(`Unsupported filter operator: ${filter.operator}`);
  }
}

function parsePostgrestAtom(expression: string, params: unknown[]): string {
  const atom = expression.trim();
  if (atom.startsWith('and(') && atom.endsWith(')')) {
    const inner = atom.slice(4, -1);
    return `(${splitTopLevel(inner).map((part) => parsePostgrestAtom(part, params)).join(' AND ')})`;
  }

  const match = atom.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-z]+)\.([\s\S]*)$/);
  if (!match) {
    throw new BadRequestException(`Unsupported OR expression: ${expression}`);
  }

  const [, column, operator, rawValue] = match;
  const value = rawValue === '' ? '' : rawValue;
  const mappedOperator = operator as FilterOperator;
  return buildFilterSql({ column, operator: mappedOperator, value }, params);
}

export function buildPostgrestOrSql(expression: string, params: unknown[]): string {
  const parts = splitTopLevel(expression);
  if (!parts.length) return 'TRUE';
  return `(${parts.map((part) => parsePostgrestAtom(part, params)).join(' OR ')})`;
}

export function buildWhereSql(filters: ResourceFilter[] = [], orExpressions: string[] = [], params: unknown[]): string {
  const clauses = [
    ...filters.map((filter) => buildFilterSql(filter, params)),
    ...orExpressions.map((expression) => buildPostgrestOrSql(expression, params)),
  ];

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

export function buildOrderSql(orders: ResourceOrder[] = []): string {
  if (!orders.length) return '';
  const clauses = orders.map((order) => `${quoteIdentifier(order.column)} ${order.ascending === false ? 'DESC' : 'ASC'}`);
  return `ORDER BY ${clauses.join(', ')}`;
}
