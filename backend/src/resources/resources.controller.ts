import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { isComunicante } from '../auth/auth.types';
import { DeleteDto, InsertDto, UpdateDto } from './dto/mutation.dto';
import { ResourceQueryDto } from './dto/resource-query.dto';
import { authorizeResource, sanitizeResourceResult } from './resources.policy';
import { ResourcesService } from './resources.service';

@Controller('data/:table')
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly auth: AuthService,
  ) {}

  @Post('query')
  async query(@Param('table') table: string, @Body() dto: ResourceQueryDto, @Req() request: Request) {
    authorizeResource(request.authUser, table, 'query', dto);
    return sanitizeResourceResult(table, await this.resources.query(table, dto));
  }

  @Post('insert')
  async insert(@Param('table') table: string, @Body() dto: InsertDto, @Req() request: Request) {
    authorizeResource(request.authUser, table, 'insert', dto);
    if (isComunicante(request.authUser)) await this.resources.conferirAutoriaComunicante(table, 'insert', dto, request.authUser!);
    const result = sanitizeResourceResult(table, await this.resources.insert(table, dto));
    this.afterMutation(table);
    return result;
  }

  @Post('update')
  async update(@Param('table') table: string, @Body() dto: UpdateDto, @Req() request: Request) {
    authorizeResource(request.authUser, table, 'update', dto);
    if (isComunicante(request.authUser)) await this.resources.conferirAutoriaComunicante(table, 'update', dto, request.authUser!);
    const result = sanitizeResourceResult(table, await this.resources.update(table, dto));
    this.afterMutation(table);
    return result;
  }

  @Post('delete')
  async delete(@Param('table') table: string, @Body() dto: DeleteDto, @Req() request: Request) {
    authorizeResource(request.authUser, table, 'delete', dto);
    if (isComunicante(request.authUser)) await this.resources.conferirAutoriaComunicante(table, 'delete', dto, request.authUser!);
    const result = sanitizeResourceResult(table, await this.resources.delete(table, dto, request.authUser));
    this.afterMutation(table);
    return result;
  }

  private afterMutation(table: string): void {
    // Mudanca de funcao ou exclusao de usuario passa a valer imediatamente.
    if (table === 'usuarios') this.auth.invalidateUserCache();
  }
}
