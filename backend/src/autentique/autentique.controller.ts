import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { isAdmin, Public } from '../auth/auth.types';
import { AutentiqueService } from './autentique.service';
import { EnviosService } from './envios.service';

/** O proxy repassa qualquer chamada com a chave da empresa: fica só para administradores. */
function exigirAdmin(request: Request) {
  if (!request.authUser || !isAdmin(request.authUser)) {
    throw new ForbiddenException('Só um administrador pode usar o acesso direto ao Autentique.');
  }
}

@Controller('autentique')
export class AutentiqueController {
  constructor(
    private readonly autentique: AutentiqueService,
    private readonly envios: EnviosService,
  ) {}

  @Post('proxy')
  proxyJson(@Body() body: Record<string, unknown>, @Req() request: Request, @Headers('x-autentique-sandbox') sandbox?: string) {
    exigirAdmin(request);
    return this.autentique.proxyJson(body, sandbox === 'true');
  }

  @Post('proxy/upload')
  @UseInterceptors(FileInterceptor('file'))
  proxyUpload(
    @Body() body: { operations?: string; map?: string },
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
    @Headers('x-autentique-sandbox') sandbox?: string,
  ) {
    exigirAdmin(request);
    return this.autentique.proxyUpload(body, file, sandbox === 'true');
  }

  /** Aviso do Autentique quando alguém assina, recusa ou o documento termina. */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-autentique-signature') assinatura?: string) {
    return this.envios.receberWebhook(request.rawBody, assinatura);
  }
}
