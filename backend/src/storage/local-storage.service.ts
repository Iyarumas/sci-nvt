import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import { basename, dirname, join, normalize, resolve } from 'path';

/**
 * Pastas que existem no storage (lista fechada). Nova pasta precisa entrar aqui.
 * - document-pdfs: modelos de documentos (tela Gerenciar Documentos);
 * - autentique-assinados: PDFs assinados, gravados e lidos só pelo servidor (envios do Autentique).
 */
export const ALLOWED_BUCKETS: ReadonlySet<string> = new Set(['document-pdfs', 'autentique-assinados']);
/** Pastas que as telas acessam direto por /storage/:bucket. Os assinados só saem pelas rotas do Autentique. */
export const PUBLIC_BUCKETS: ReadonlySet<string> = new Set(['document-pdfs']);
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from('%PDF-');

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
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Arquivo maior que ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    }
    if (!file.buffer.subarray(0, 5).equals(PDF_SIGNATURE)) {
      throw new BadRequestException('Envie um arquivo PDF.');
    }
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

  createSignedUrl(bucket: string, storagePath: string, signature: { exp: string; sig: string }): { signedUrl: string } {
    this.safePath(bucket, storagePath);
    const url = new URL(`${this.publicBaseUrl}/storage/${encodeURIComponent(bucket)}/file`);
    url.searchParams.set('path', storagePath);
    url.searchParams.set('exp', signature.exp);
    url.searchParams.set('sig', signature.sig);
    return { signedUrl: url.toString() };
  }

  private safePath(bucket: string, storagePath: string): string {
    // Lista fechada: nomes como "." ou ".." apontariam para fora da pasta de arquivos.
    if (!ALLOWED_BUCKETS.has(bucket)) {
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
