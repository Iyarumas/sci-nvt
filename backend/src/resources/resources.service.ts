import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
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

export interface ResourceResult<T = QueryResultRow[] | QueryResultRow | null> {
  data: T;
  error: null;
  count?: number | null;
}

// Os documentos de referência de 2026 já emitiram estes números fora do sistema.
const EXERCISE_NUMBER_BASE: Record<string, number> = {
  exercicios_posicionamento: 42,
  treinamentos_tempo_resposta: 24,
};

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
    if (table === 'ptrba_completo_registros') {
      return this.database.transaction(async (client) => {
        const rows = Array.isArray(dto.payload) ? dto.payload : dto.payload ? [dto.payload] : [];
        if (!rows.length) throw new BadRequestException('Insert payload is required');
        const created: QueryResultRow[] = [];
        for (const row of rows) {
          this.validatePtrbaOrigem(row);
          this.validatePtrbaApoc(row);
          const columns = Object.keys(row);
          if (!columns.length) throw new BadRequestException('Insert payload must contain at least one column');
          const result = await client.query(
            `INSERT INTO ${this.tableName(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
            columns.map(column => row[column]),
          );
          created.push(...result.rows);
        }
        return { data: this.selectPtrbaRows(created, dto.select), error: null };
      });
    }
    if (EXERCISE_NUMBER_BASE[table] !== undefined) {
      return this.database.transaction(async (client) => {
        await this.lockExerciseNumbers(client, table);
        const rows = Array.isArray(dto.payload) ? dto.payload : dto.payload ? [dto.payload] : [];
        if (!rows.length) throw new BadRequestException('Insert payload is required');
        const created: QueryResultRow[] = [];
        for (const payload of rows) {
          const row = { ...payload };
          if (row.numero === 0) {
            const result = await client.query<{ numero: number }>(
              `SELECT COALESCE(MAX(numero), 0)::int AS numero FROM ${this.tableName(table)} WHERE ano = $1`,
              [row.ano],
            );
            row.numero = Math.max(result.rows[0].numero, row.ano === '2026' ? EXERCISE_NUMBER_BASE[table] : 0) + 1;
          }
          await this.validateExerciseNumber(client, table, row);
          const columns = Object.keys(row);
          const result = await client.query(
            `INSERT INTO ${this.tableName(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING ${selectClause(dto.select)}`,
            columns.map((column) => row[column]),
          );
          created.push(...result.rows);
        }
        return { data: dto.select !== undefined ? created : null, error: null };
      });
    }
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
    if (table === 'ptrba_completo_registros') {
      return this.database.transaction(async (client) => {
        const params: unknown[] = [];
        const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
        if (!whereSql) throw new BadRequestException('Update requires at least one filter');
        this.validatePtrbaOrigem(dto.payload);
        const current = await client.query(`SELECT * FROM ${this.tableName(table)} ${whereSql} FOR UPDATE`, params);
        for (const row of current.rows) {
          if (row.origem_ptrba_id) {
            throw new BadRequestException('O documento APOC legado é preservado somente para consulta.');
          }
          if (dto.payload.is_apoc !== undefined && dto.payload.is_apoc !== row.is_apoc) {
            throw new BadRequestException('A modalidade do PTR-BA não pode ser alterada na edição.');
          }
          this.validatePtrbaApoc({ ...row, ...dto.payload });
        }
        const columns = Object.keys(dto.payload);
        if (!columns.length) throw new BadRequestException('Update payload must contain at least one column');
        const values = columns.map((column) => dto.payload[column]);
        const updateWhere = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, values);
        const result = await client.query(
          `UPDATE ${this.tableName(table)} SET ${columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ')} ${updateWhere} RETURNING *`,
          values,
        );
        return { data: this.selectPtrbaRows(result.rows, dto.select), error: null };
      });
    }
    if (EXERCISE_NUMBER_BASE[table] !== undefined && ['numero', 'ano', 'data'].some((key) => dto.payload[key] !== undefined)) {
      return this.database.transaction(async (client) => {
        await this.lockExerciseNumbers(client, table);
        const params: unknown[] = [];
        const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
        if (!whereSql) throw new BadRequestException('Update requires at least one filter');
        const current = await client.query(`SELECT id, numero, ano, data FROM ${this.tableName(table)} ${whereSql} FOR UPDATE`, params);
        // Uma edição de documento deve apontar para um único ID.
        if (current.rows.length > 1) throw new BadRequestException('Edite a numeração de um documento por vez.');
        for (const row of current.rows) {
          await this.validateExerciseNumber(client, table, { ...row, ...dto.payload }, row.id as string);
        }
        const columns = Object.keys(dto.payload);
        const values = columns.map((column) => dto.payload[column]);
        const updateWhere = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, values);
        const returningSql = dto.select !== undefined ? `RETURNING ${selectClause(dto.select)}` : '';
        const result = await client.query(
          `UPDATE ${this.tableName(table)} SET ${columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ')} ${updateWhere} ${returningSql}`,
          values,
        );
        return { data: dto.select !== undefined ? result.rows : null, error: null };
      });
    }
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
    if (table === 'ptrba_completo_registros') {
      return this.database.transaction(async client => {
        const params: unknown[] = [];
        const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
        if (!whereSql) throw new BadRequestException('Delete requires at least one filter');
        const current = await client.query(`SELECT * FROM ${this.tableName(table)} ${whereSql} FOR UPDATE`, params);
        if (current.rows.some(row => row.origem_ptrba_id)) {
          throw new BadRequestException('O documento APOC legado é preservado somente para consulta.');
        }
        const result = await client.query(`DELETE FROM ${this.tableName(table)} ${whereSql} RETURNING *`, params);
        return { data: this.selectPtrbaRows(result.rows, dto.select), error: null };
      });
    }
    const safeTable = this.tableName(table);
    const params: unknown[] = [];
    const whereSql = buildWhereSql((dto.filters ?? []) as ResourceFilter[], dto.or, params);
    if (!whereSql) throw new BadRequestException('Delete requires at least one filter');

    const returningSql = dto.select !== undefined ? `RETURNING ${selectClause(dto.select)}` : '';
    const result = await this.database.query(`DELETE FROM ${safeTable} ${whereSql} ${returningSql}`, params);
    return { data: dto.select !== undefined ? result.rows : null, error: null };
  }

  private validatePtrbaOrigem(row: Record<string, unknown>): void {
    if (row.origem_ptrba_id !== undefined) {
      throw new BadRequestException('O vínculo legado do documento APOC não pode ser alterado.');
    }
  }

  private selectPtrbaRows(rows: QueryResultRow[], selection?: string): QueryResultRow[] | null {
    if (selection === undefined) return null;
    if (selectClause(selection) === '*') return rows;
    return rows.map(row => Object.fromEntries(selection.split(',').map(column => [column.trim(), row[column.trim()]])));
  }

  private validatePtrbaApoc(row: Record<string, unknown>): void {
    if (row.is_apoc !== undefined && typeof row.is_apoc !== 'boolean') {
      throw new BadRequestException('Informe uma modalidade válida para o PTR-BA.');
    }
    if (!row.is_apoc) return;
    let participantes: unknown = row.participantes;
    if (typeof participantes === 'string') {
      try { participantes = JSON.parse(participantes); } catch {
        throw new BadRequestException('Participantes do PTR-BA APOC inválidos.');
      }
    }
    if (!Array.isArray(participantes) || participantes.length > 15 || !participantes.some(p => p && typeof p.nomeCompleto === 'string' && p.nomeCompleto.trim())) {
      throw new BadRequestException('Selecione pelo menos um APOC (máximo de 15 participantes).');
    }
    const nomes = new Set<string>();
    for (const participante of participantes) {
      if (!participante || participante.funcao !== 'APOC' || typeof participante.nomeCompleto !== 'string') {
        throw new BadRequestException('O PTR-BA somente APOC aceita apenas participantes com função APOC.');
      }
      const nome = participante.nomeCompleto.trim().toLocaleLowerCase('pt-BR');
      if (!nome) continue;
      if (nomes.has(nome)) throw new BadRequestException('O mesmo APOC não pode ser selecionado mais de uma vez.');
      nomes.add(nome);
    }
  }

  private tableName(table: string): string {
    if (!ALLOWED_TABLES.has(table)) {
      throw new NotFoundException(`Resource table not exposed: ${table}`);
    }
    return quoteIdentifier(table);
  }

  private async lockExerciseNumbers(client: PoolClient, table: string): Promise<void> {
    this.tableName(table);
    // O lock dura até o commit: formulários simultâneos recebem números diferentes.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`document-number:${table}`]);
  }

  private async validateExerciseNumber(client: PoolClient, table: string, row: Record<string, unknown>, id?: string): Promise<void> {
    if (!Number.isInteger(row.numero) || Number(row.numero) < 1 || Number(row.numero) > 2147483647) {
      throw new BadRequestException('Informe um número inteiro maior que zero para o documento.');
    }
    if (typeof row.ano !== 'string' || !/^\d{4}$/.test(row.ano) || typeof row.data !== 'string' || row.data.slice(0, 4) !== row.ano) {
      throw new BadRequestException('O ano do documento deve corresponder ao ano da data do exercício.');
    }
    const duplicates = await client.query(
      `SELECT id FROM ${this.tableName(table)} WHERE ano = $1 AND numero = $2 AND ($3::uuid IS NULL OR id <> $3::uuid) LIMIT 1`,
      [row.ano, row.numero, id || null],
    );
    if (duplicates.rows.length) throw new BadRequestException(`Já existe um documento com o número ${row.numero}/${row.ano}. Escolha outro número.`);
  }
}
