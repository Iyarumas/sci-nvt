import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import { basename, dirname, join, normalize, resolve } from 'path';

@Injectable()
export class LocalStorageService {
  private readonly rootPath: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.rootPath = resolve(config.get<string>('STORAGE_PATH', './storage'));
    const port = config.get<number>('PORT', 3333);
    const prefix = config.get<string>('API_PREFIX', 'api');
    this.publicBaseUrl = config.get<string>('PUBLIC_API_URL', `http://localhost:${port}/${prefix}`);
  }

  async upload(bucket: string, storagePath: string, file: Express.Multer.File): Promise<{ path: string }> {
    if (!file) throw new BadRequestException('File is required');
    const target = this.safePath(bucket, storagePath);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, file.buffer);
    return { path: storagePath };
  }

  async list(bucket: string, prefix = ''): Promise<{ name: string; id: string; path: string }[]> {
    const dir = this.safePath(bucket, prefix);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        id: join(prefix, entry.name).replace(/\\/g, '/'),
        path: join(prefix, entry.name).replace(/\\/g, '/'),
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (storagePath) => {
        const target = this.safePath(bucket, storagePath);
        try {
          await fs.unlink(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }),
    );
  }

  async getFile(bucket: string, storagePath: string) {
    const target = this.safePath(bucket, storagePath);
    try {
      await fs.access(target);
    } catch {
      throw new NotFoundException('File not found');
    }
    return {
      stream: createReadStream(target),
      filename: basename(target),
    };
  }

  createSignedUrl(bucket: string, storagePath: string): { signedUrl: string } {
    const url = new URL(`${this.publicBaseUrl}/storage/${encodeURIComponent(bucket)}/file`);
    url.searchParams.set('path', storagePath);
    return { signedUrl: url.toString() };
  }

  private safePath(bucket: string, storagePath: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(bucket)) {
      throw new BadRequestException('Invalid bucket name');
    }
    const target = resolve(this.rootPath, bucket, normalize(storagePath || '.'));
    const bucketRoot = resolve(this.rootPath, bucket);
    if (target !== bucketRoot && !target.startsWith(`${bucketRoot}${process.platform === 'win32' ? '\\' : '/'}`)) {
      throw new BadRequestException('Invalid storage path');
    }
    return target;
  }
}
