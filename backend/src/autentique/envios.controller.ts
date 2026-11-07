import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
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
    @Body() body: { tipo?: string; referenciaId?: string; participantes?: string; chefeEquipe?: string; nomeArquivo?: string; linhasAssinatura?: string },
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
      nomeArquivo: body.nomeArquivo || pdf?.originalname,
      linhasAssinatura: (() => {
        try { return JSON.parse(body.linhasAssinatura ?? '[]'); } catch { return []; }
      })(),
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

  @Post(':id/atualizar')
  atualizar(@Param('id') id: string, @Req() request: Request) {
    return this.envios.atualizar(usuario(request), id);
  }

  @Post(':id/signatarios/:signatarioId/link')
  link(@Param('id') id: string, @Param('signatarioId') signatarioId: string, @Req() request: Request) {
    return this.envios.linkDeAssinatura(usuario(request), id, signatarioId);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    usuario(request);
    const arquivo = await this.envios.pdfAssinado(id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${arquivo.filename}"`);
    arquivo.stream.pipe(response);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() request: Request) {
    return this.envios.cancelar(usuario(request), id);
  }
}
