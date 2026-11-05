import { Body, Controller, Get, Param, Put, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/auth.types';
import { InicioPlantaoService, TipoPlantao } from './inicio-plantao.service';

type CorpoPlantao = { data?: string; equipe?: string; dados?: unknown; mensagem?: string };

function usuario(request: Request) {
  if (!request.authUser) throw new UnauthorizedException('Autenticação necessária.');
  return request.authUser;
}

@Controller('inicio-plantao')
export class InicioPlantaoController {
  constructor(private readonly plantao: InicioPlantaoService) {}

  @Get()
  obter(@Query('data') data: string, @Query('equipe') equipe: string) {
    return this.plantao.obter('inicio', String(data ?? ''), String(equipe ?? ''));
  }

  @Get('anterior')
  anterior(@Query('data') data: string) {
    return this.plantao.anterior('inicio', String(data ?? ''));
  }

  @Put()
  salvar(@Body() body: CorpoPlantao, @Req() request: Request) {
    return this.plantao.salvar('inicio', usuario(request), body);
  }

  /** Aberto de propósito: o QR Code é lido no celular, sem login. O token é aleatório e expira. */
  @Public()
  @Get('mensagem/:token')
  mensagem(@Param('token') token: string) {
    return this.plantao.mensagemPublica(token);
  }
}

@Controller('fim-plantao')
export class FimPlantaoController {
  constructor(private readonly plantao: InicioPlantaoService) {}

  private readonly tipo: TipoPlantao = 'fim';

  @Get()
  obter(@Query('data') data: string, @Query('equipe') equipe: string) {
    return this.plantao.obter(this.tipo, String(data ?? ''), String(equipe ?? ''));
  }

  @Get('anterior')
  anterior(@Query('data') data: string) {
    return this.plantao.anterior(this.tipo, String(data ?? ''));
  }

  @Put()
  salvar(@Body() body: CorpoPlantao, @Req() request: Request) {
    return this.plantao.salvar(this.tipo, usuario(request), body);
  }
}
