import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { authorizeResource } from './resources.policy';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lista de PTR-BA sem as fotos (cada PTR-BA tem ~1 MB de imagens guardadas no próprio registro).
 * As telas que só mostram cards, relatórios e estatísticas usam esta lista; a foto só é
 * buscada (pelo CRUD normal, um registro por vez) quando a pessoa abre o documento.
 */
@Controller('ptrba')
export class PtrbaResumoController {
  constructor(private readonly database: DatabaseService) {}

  @Get('resumo')
  async resumo(
    @Req() request: Request,
    @Query('dataGte') dataGte?: string,
    @Query('dataLte') dataLte?: string,
    @Query('equipe') equipe?: string,
    @Query('createdBy') createdBy?: string,
  ) {
    authorizeResource(request.authUser, 'ptrba_completo_registros', 'query', {});
    const params: unknown[] = [];
    const where: string[] = [];
    if (dataGte && DATA.test(dataGte)) { params.push(dataGte); where.push(`data >= $${params.length}`); }
    if (dataLte && DATA.test(dataLte)) { params.push(dataLte); where.push(`data <= $${params.length}`); }
    if (equipe) { params.push(String(equipe)); where.push(`equipe = $${params.length}`); }
    if (createdBy) { params.push(String(createdBy)); where.push(`created_by = $${params.length}`); }

    const result = await this.database.query(
      `SELECT id, created_by, created_at, updated_at, updated_by, data, equipe, identificacao_aeroporto, observacoes,
              chefe_equipe, participantes, status, concluido_por, concluido_por_nome, concluido_em,
              is_extra, is_apoc, origem_ptrba_id,
              CASE WHEN jsonb_typeof(r.evidencias) = 'array' THEN (
                SELECT coalesce(jsonb_agg(
                  CASE WHEN jsonb_typeof(e) = 'object'
                    THEN (e - 'imagem') || jsonb_build_object('temImagem', coalesce(e->>'imagem', '') <> '')
                    ELSE e END
                  ORDER BY ordem), '[]'::jsonb)
                FROM jsonb_array_elements(r.evidencias) WITH ORDINALITY AS t(e, ordem)
              ) ELSE '[]'::jsonb END AS evidencias
         FROM ptrba_completo_registros r
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY data DESC, created_at DESC`,
      params,
    );
    return result.rows;
  }
}
