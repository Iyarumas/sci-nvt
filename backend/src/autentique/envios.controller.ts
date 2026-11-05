import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { EnviosService, ParticipanteEnvio } from './envios.service';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function usuario(request: Request): AuthUser {
  if (!request.authUser) throw new UnauthorizedException('Autenticação necessária.');
  return request.authUser;
}

@Controller('autentique/envios')
export class EnviosController {
  constructor(private readonly envios: EnviosService) {}

  @Get()
  listar(@Query('tipo') tipo: string, @Query('referencias') referencias: string, @Req() request: Request) {
    return this.envios.listar(usuario(request), tipo, String(referencias ?? '').split(',').filter(Boolean));
  }

  @Post()
  @UseInterceptors(FileInterceptor('pdf', { limits: { fileSize: MAX_PDF_BYTES } }))
  enviar(
    @Body() body: { tipo?: string; referenciaId?: string; participantes?: string; chefeEquipe?: string },
    @UploadedFile() pdf: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    let participantes: ParticipanteEnvio[];
    try {
      participantes = JSON.parse(body.participantes ?? '[]');
    } catch {
      throw new BadRequestException('Lista de participantes inválida.');
    }
    return this.envios.enviar(usuario(request), {
      tipo: String(body.tipo ?? ''),
      referenciaId: String(body.referenciaId ?? ''),
      participantes,
      chefeEquipe: body.chefeEquipe,
      pdf: pdf?.buffer,
    });
  }

  @Post('previa')
  previa(
    @Body() body: { tipo?: string; referenciaId?: string; participantes?: ParticipanteEnvio[]; chefeEquipe?: string },
    @Req() request: Request,
  ) {
    return this.envios.previa(usuario(request), {
      tipo: String(body.tipo ?? ''),
      referenciaId: String(body.referenciaId ?? ''),
      participantes: Array.isArray(body.participantes) ? body.participantes : [],
      chefeEquipe: body.chefeEquipe,
    });
  }

  @Post(':id/reenviar')
  reenviar(@Param('id') id: string, @Req() request: Request) {
    return this.envios.reenviar(usuario(request), id);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() request: Request) {
    return this.envios.cancelar(usuario(request), id);
  }
}
