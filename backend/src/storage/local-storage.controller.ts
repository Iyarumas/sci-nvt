import {
  Body,
  Controller,
  ForbiddenException,
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
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/auth.types';
import { LocalStorageService } from './local-storage.service';

@Controller('storage/:bucket')
export class LocalStorageController {
  constructor(
    private readonly storage: LocalStorageService,
    private readonly auth: AuthService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('bucket') bucket: string,
    @Query('path') path: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    this.assertCanWrite(request);
    return this.storage.upload(bucket, path, file);
  }

  @Get('list')
  list(@Param('bucket') bucket: string, @Query('prefix') prefix = '') {
    return this.storage.list(bucket, prefix);
  }

  @Post('remove')
  async remove(@Param('bucket') bucket: string, @Body() body: { paths?: string[] }, @Req() request: Request) {
    this.assertCanWrite(request);
    await this.storage.remove(bucket, body.paths ?? []);
    return { ok: true };
  }

  @Post('signed-url')
  signedUrl(@Param('bucket') bucket: string, @Body() body: { path?: string }) {
    const path = body.path ?? '';
    return this.storage.createSignedUrl(bucket, path, this.auth.signFileLink(bucket, path));
  }

  /**
   * Download de arquivo: aceita o token no cabecalho (fetch do app) ou um link
   * assinado e temporario (gerado por /signed-url, para abrir em nova aba/iframe).
   */
  @Public()
  @Get('file')
  async file(
    @Param('bucket') bucket: string,
    @Query('path') path: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const allowed = !!request.authUser || this.auth.verifyFileLink(bucket, path ?? '', exp, sig);
    if (!allowed) throw new UnauthorizedException('Link expirado ou sem autorização.');
    const file = await this.storage.getFile(bucket, path);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
    file.stream.pipe(res);
  }

  private assertCanWrite(request: Request): void {
    if (request.authUser?.role === 'sem_funcao') {
      throw new ForbiddenException('Seu usuário ainda aguarda a atribuição de uma função.');
    }
  }
}
