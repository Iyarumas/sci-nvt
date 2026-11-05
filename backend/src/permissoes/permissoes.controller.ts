import { Body, Controller, Get, Put, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AlteracaoPermissao, PermissoesService } from './permissoes.service';

@Controller('permissoes')
export class PermissoesController {
  constructor(private readonly permissoes: PermissoesService) {}

  /** Qualquer usuário logado lê a grade: as telas vão usar para mostrar ou esconder botões. */
  @Get()
  listar() {
    return this.permissoes.listar();
  }

  @Put()
  salvar(@Body() body: { alteracoes?: AlteracaoPermissao[] }, @Req() request: Request) {
    if (!request.authUser) throw new UnauthorizedException('Autenticação necessária.');
    return this.permissoes.salvar(request.authUser, body.alteracoes ?? []);
  }
}
