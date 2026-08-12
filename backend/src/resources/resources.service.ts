import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  buildOrderSql,
  buildWhereSql,
  quoteIdentifier,
  ResourceFilter,
  ResourceOrder,
  selectClause,
} from '../common/utils/sql';
import { ALLOWED_TABLES } from './resources.config';
import { DeleteDto, InsertDto, UpdateDto } from './dto/mutation.dto';
import { ResourceQueryDto } from './dto/resource-query.dto';

interface ResourceResult<T = QueryResultRow[] | QueryResultRow | null> {
  data: T;
  error: null;
  count?: number | null;
}

@Injectable()
export class ResourcesService {
  constructor(private readonly database: DatabaseService) {}

  async query(table: string, dto: ResourceQueryDto): Promise<ResourceResult> {
    const safeTable = this.tableName(table);
    const filters = (dto.filters ?? []) as ResourceFilter[];
    const orders = (dto.orders ?? []) as ResourceOrder[];
    const params: unknown[] = [];
    const whereSql = buildWhereSql(filters, dto.or, params);

    if (dto.count === 'exact' && dto.head) {
      const countSql = `SELECT COUNT(*)::int AS count FROM ${safeTable} ${whereSql}`;
      const result = await this.database.query<{ count: number }>(countSql, params);
      return { data: null, error: null, count: result.rows[0]?.count ?? 0 };
    }

    const orderSql = buildOrderSql(orders);
    const limitSql = dto.limit ? `LIMIT ${dto.limit}` : '';
    const sql = `SELECT ${selectClause(dto.select)} FROM ${safeTable} ${whereSql} ${orderSql} ${limitSql}`;
    const result = await this.database.query(sql, params);
    return { data: result.rows, error: null };
  }

  async insert(table: string, dto: InsertDto): Promise<ResourceResult> {
    const safeTable = this.tableName(table);
    const rows = Array.isArray(dto.payload) ? dto.payload : dto.payload ? [dto.payload] : [];
    if (!rows.length) throw new BadRequestException('Insert payload is required');

    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!columns.length) throw new BadRequestException('Insert payload must contain at least one column');

    const params: unknown[] = [];
    const valuesSql = rows
      .map((row) => {
        const placeholders = columns.map((column) => {
          params.push(row[column] ?? null);
          return `$${params.length}`;
        });
        return `(${placeholders.join(', ')})`;
      })
      .join(', ');

    const columnSql = columns.map(quoteIdentifier).join(', ');
    const returningSql = dto.select !== undefined ? `RETURNING ${selectClause(dto.select)}` : '';
    const sql = `INSERT INTO ${safeTable} (${columnSql}) VALUES ${valuesSql} ${returningSql}`;
    const result = await this.database.query(sql, params);
    return { data: dto.select !== undefined ? result.rows : null, error: null };
  }

  async update(table: string, dto: UpdateDto): Promise<ResourceResult> {
    const safeTable = this.tableName(table);
    const payload = dto.payload ?? {};
    const columns = Object.keys(payload);
    if (!columns.length) throw new BadRequestException('Update payload must contain at least one column');

    const params: unknown[] = [];
    const setSql = columns
      .map((column) => {
        params.push(payload[column]);
        return `${quoteIdentifier(column)} = $${params.length}`;
      })
      .join(', ');
    const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
    if (!whereSql) throw new BadRequestException('Update requires at least one filter');

    const returningSql = dto.select !== undefined ? `RETURNING ${selectClause(dto.select)}` : '';
    const result = await this.database.query(
      `UPDATE ${safeTable} SET ${setSql} ${whereSql} ${returningSql}`,
      params,
    );
    return { data: dto.select !== undefined ? result.rows : null, error: null };
  }

  async delete(table: string, dto: DeleteDto): Promise<ResourceResult> {
    const safeTable = this.tableName(table);
    const params: unknown[] = [];
    const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
    if (!whereSql) throw new BadRequestException('Delete requires at least one filter');

    const returningSql = dto.select !== undefined ? `RETURNING ${selectClause(dto.select)}` : '';
    const result = await this.database.query(`DELETE FROM ${safeTable} ${whereSql} ${returningSql}`, params);
    return { data: dto.select !== undefined ? result.rows : null, error: null };
  }

  private tableName(table: string): string {
    if (!ALLOWED_TABLES.has(table)) {
      throw new NotFoundException(`Resource table not exposed: ${table}`);
    }
    return quoteIdentifier(table);
  }
}
