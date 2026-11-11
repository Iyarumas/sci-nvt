import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { LocalStorageService, MAX_UPLOAD_BYTES, PUBLIC_BUCKETS } = require('../dist/storage/local-storage.service.js');

async function withStorage(run) {
  const root = await mkdtemp(join(tmpdir(), 'sci-storage-'));
  try {
    const config = { get: (key, fallback) => (key === 'STORAGE_PATH' ? join(root, 'storage') : fallback) };
    await run(new LocalStorageService(config), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const pdf = (extra = '') => ({ buffer: Buffer.from(`%PDF-1.7 ${extra}`), size: 9 + extra.length });

test('buckets "." e ".." e desconhecidos são recusados (não saem da pasta de arquivos)', async () => {
  await withStorage(async (storage) => {
    for (const bucket of ['.', '..', 'outro-bucket', '']) {
      await assert.rejects(storage.upload(bucket, 'x.pdf', pdf()), /Invalid bucket/);
      await assert.rejects(storage.getFile(bucket, 'x.pdf'), /Invalid bucket/);
      await assert.rejects(storage.list(bucket), /Invalid bucket/);
    }
  });
});

test('o servidor grava e lê os PDFs assinados (autentique-assinados), mas as telas não acessam essa pasta direto', async () => {
  await withStorage(async (storage) => {
    assert.deepEqual(await storage.upload('autentique-assinados', 'bona/x/y.pdf', pdf()), { path: 'bona/x/y.pdf' });
    const arquivo = await storage.getFile('autentique-assinados', 'bona/x/y.pdf');
    arquivo.stream.destroy();
    assert.equal(PUBLIC_BUCKETS.has('autentique-assinados'), false);
    assert.equal(PUBLIC_BUCKETS.has('document-pdfs'), true);
  });
});

test('caminho com ../ dentro do bucket permitido continua bloqueado', async () => {
  await withStorage(async (storage) => {
    await assert.rejects(storage.upload('document-pdfs', '../../fora.pdf', pdf()), /Invalid storage path/);
  });
});

test('upload aceita só PDF e dentro do limite de tamanho', async () => {
  await withStorage(async (storage, root) => {
    await assert.rejects(storage.upload('document-pdfs', 'a/x.pdf', { buffer: Buffer.from('MZ executavel'), size: 12 }), /PDF/);
    await assert.rejects(storage.upload('document-pdfs', 'a/x.pdf', { buffer: Buffer.from('%PDF-'), size: MAX_UPLOAD_BYTES + 1 }), /maior/);
    assert.deepEqual(await storage.upload('document-pdfs', 'a/ok.pdf', pdf()), { path: 'a/ok.pdf' });
    assert.deepEqual(await readdir(join(root, 'storage', 'document-pdfs', 'a')), ['ok.pdf']);
  });
});
