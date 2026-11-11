import { Body, Controller, Get, Put, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { MudancaFuncao, MudancaUsuario, PermissoesService } from './permissoes.service';

function usuarioDa(request: Request) {
  if (!request.authUser) throw new UnauthorizedException('Autenticação necessária.');
  return request.authUser;
}

@Controller('permissoes')
export class PermissoesController {
  constructor(private readonly permissoes: PermissoesService) {}

  /** Grade completa, usuários e exceções (só administrador). */
  @Get()
  listar(@Req() request: Request) {
    return this.permissoes.listar(usuarioDa(request));
  }

  /** O que o usuário logado pode fazer em cada ação. */
  @Get('minhas')
  minhas(@Req() request: Request) {
    return this.permissoes.minhas(usuarioDa(request));
  }

  @Put()
  salvar(@Body() body: { funcoes?: MudancaFuncao[]; usuarios?: MudancaUsuario[] }, @Req() request: Request) {
    return this.permissoes.salvar(usuarioDa(request), body.funcoes ?? [], body.usuarios ?? []);
  }
}
