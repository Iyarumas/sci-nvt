import { Body, Controller, Get, Param, Put, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/auth.types';
import { InicioPlantaoService } from './inicio-plantao.service';

@Controller('inicio-plantao')
export class InicioPlantaoController {
  constructor(private readonly inicioPlantao: InicioPlantaoService) {}

  @Get()
  obter(@Query('data') data: string, @Query('equipe') equipe: string) {
    return this.inicioPlantao.obter(String(data ?? ''), String(equipe ?? ''));
  }

  @Get('anterior')
  anterior(@Query('data') data: string) {
    return this.inicioPlantao.anterior(String(data ?? ''));
  }

  @Put()
  salvar(@Body() body: { data?: string; equipe?: string; dados?: unknown; mensagem?: string }, @Req() request: Request) {
    if (!request.authUser) throw new UnauthorizedException('Autenticação necessária.');
    return this.inicioPlantao.salvar(request.authUser, body);
  }

  /** Aberto de propósito: o QR Code é lido no celular, sem login. O token é aleatório e expira. */
  @Public()
  @Get('mensagem/:token')
  mensagem(@Param('token') token: string) {
    return this.inicioPlantao.mensagemPublica(token);
  }
}
