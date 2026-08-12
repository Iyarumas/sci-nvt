import { Body, Controller, Headers, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AutentiqueService } from './autentique.service';

@Controller('autentique')
export class AutentiqueController {
  constructor(private readonly autentique: AutentiqueService) {}

  @Post('proxy')
  proxyJson(@Body() body: Record<string, unknown>, @Headers('x-autentique-sandbox') sandbox?: string) {
    return this.autentique.proxyJson(body, sandbox === 'true');
  }

  @Post('proxy/upload')
  @UseInterceptors(FileInterceptor('file'))
  proxyUpload(
    @Body() body: { operations?: string; map?: string },
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-autentique-sandbox') sandbox?: string,
  ) {
    return this.autentique.proxyUpload(body, file, sandbox === 'true');
  }
}
