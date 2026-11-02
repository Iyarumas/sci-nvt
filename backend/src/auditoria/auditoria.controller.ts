import { Controller, ForbiddenException, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { isAdmin } from '../auth/auth.types';
import { AuditoriaService } from './auditoria.service';
import { ListarExclusoesDto } from './dto/listar-exclusoes.dto';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get('exclusoes')
  listar(@Query() dto: ListarExclusoesDto, @Req() request: Request) {
    if (!isAdmin(request.authUser)) throw new ForbiddenException('Apenas administradores podem consultar a auditoria.');
    return this.auditoria.listar(dto);
  }
}
