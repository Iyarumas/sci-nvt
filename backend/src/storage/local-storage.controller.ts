import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { LocalStorageService } from './local-storage.service';

@Controller('storage/:bucket')
export class LocalStorageController {
  constructor(private readonly storage: LocalStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('bucket') bucket: string,
    @Query('path') path: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.storage.upload(bucket, path, file);
  }

  @Get('list')
  list(@Param('bucket') bucket: string, @Query('prefix') prefix = '') {
    return this.storage.list(bucket, prefix);
  }

  @Post('remove')
  async remove(@Param('bucket') bucket: string, @Body() body: { paths?: string[] }) {
    await this.storage.remove(bucket, body.paths ?? []);
    return { ok: true };
  }

  @Post('signed-url')
  signedUrl(@Param('bucket') bucket: string, @Body() body: { path?: string }) {
    return this.storage.createSignedUrl(bucket, body.path ?? '');
  }

  @Get('file')
  async file(@Param('bucket') bucket: string, @Query('path') path: string, @Res() res: Response) {
    const file = await this.storage.getFile(bucket, path);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    file.stream.pipe(res);
  }
}
