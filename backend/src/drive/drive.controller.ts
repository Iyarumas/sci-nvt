import { Body, Controller, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DriveService } from './drive.service';

@Controller('drive')
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  /** Arquivos de cada pessoa, lidos do Google Drive (guardados por 5 minutos; ?atualizar=1 lê de novo). */
  @Get('documentos')
  documentos(@Req() request: Request, @Query('atualizar') atualizar?: string) {
    return this.drive.documentos(request.authUser, atualizar === '1');
  }

  /** Configuração da aba "Validade dos documentos" (prazos, obrigatórios, Nº, nomes juntados). */
  @Get('config')
  lerConfig(@Req() request: Request) {
    return this.drive.lerConfig(request.authUser);
  }

  @Put('config')
  salvarConfig(@Req() request: Request, @Body() body: { config?: unknown }) {
    return this.drive.salvarConfig(request.authUser, body?.config);
  }

  /** Data do curso digitada (quando o PDF não tem texto ou a data lida está errada). */
  @Post('data')
  informarData(@Req() request: Request, @Body() body: { arquivoId?: string; data?: string | null }) {
    return this.drive.informarData(request.authUser, String(body.arquivoId ?? ''), body.data ?? null);
  }

  /** Administrador vincula o arquivo a uma certificação (nome do arquivo ≠ certificado). Não renomeia no Drive. */
  @Post('tipo')
  informarTipo(@Req() request: Request, @Body() body: { arquivoId?: string; tipo?: string | null }) {
    return this.drive.informarTipo(request.authUser, String(body.arquivoId ?? ''), body.tipo ?? null);
  }

  /** Conteúdo de um arquivo para o visualizador do sistema (sem download). */
  @Get('arquivo/:id')
  async arquivo(@Req() request: Request, @Res() response: Response, @Param('id') id: string) {
    const { dados, tipo } = await this.drive.arquivo(request.authUser, id);
    response.setHeader('Content-Type', tipo);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(dados);
  }
}
