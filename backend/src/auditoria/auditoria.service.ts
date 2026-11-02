import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ALLOWED_TABLES } from '../resources/resources.config';
import { ListarExclusoesDto } from './dto/listar-exclusoes.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly database: DatabaseService) {}

  async listar(dto: ListarExclusoesDto) {
    if (dto.tabela && !/^[a-z_][a-z0-9_]{0,79}$/.test(dto.tabela)) throw new BadRequestException('Módulo inválido.');
    if (dto.inicio && dto.fim && dto.inicio > dto.fim) throw new BadRequestException('A data final deve ser igual ou posterior à inicial.');
    const params: unknown[] = [];
    const clauses: string[] = [];
    const param = (value: unknown) => { params.push(value); return `$${params.length}`; };
    if (dto.tabela) clauses.push(`tabela = ${param(dto.tabela)}`);
    if (dto.termo?.trim()) {
      const search = param(`%${dto.termo.trim().replace(/[\\%_]/g, '\\$&')}%`);
      clauses.push(`(identificacao ILIKE ${search} OR registro_id ILIKE ${search} OR usuario_login ILIKE ${search})`);
    }
    if (dto.inicio) clauses.push(`created_at >= (${param(dto.inicio)}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
    if (dto.fim) clauses.push(`created_at < ((${param(dto.fim)}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const pagina = dto.pagina ?? 1;
    const porPagina = 50;
    const count = await this.database.query<{ total: number }>(`SELECT count(*)::int AS total FROM public.auditoria_exclusoes ${where}`, params);
    const rows = await this.database.query(
      `SELECT id, created_at, tabela, registro_id, identificacao, usuario_id, usuario_login, usuario_funcao, origem
       FROM public.auditoria_exclusoes ${where} ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET $${params.length + 1}`,
      [...params, (pagina - 1) * porPagina],
    );
    const migration = await this.database.query<{ applied_at: string }>(
      "SELECT applied_at FROM schema_migrations WHERE filename = '074_auditoria_exclusoes.sql'",
    );
    // Inclui tabelas legadas ou removidas do CRUD que tenham exclusões via SQL.
    const registradas = await this.database.query<{ tabela: string }>('SELECT DISTINCT tabela FROM public.auditoria_exclusoes');
    const tabelas = [...new Set([...ALLOWED_TABLES, ...registradas.rows.map(row => row.tabela)])].sort();
    return { data: rows.rows, total: count.rows[0].total, pagina, porPagina, tabelas, inicioAuditoria: migration.rows[0]?.applied_at ?? null };
  }
}
