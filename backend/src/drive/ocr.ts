import { Logger } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Leitura de certificados que são FIGURA (escaneados, foto, "Microsoft Print to PDF" de uma imagem):
 * o PDF não tem texto dentro, então cada página vira imagem e o texto é lido com OCR (tesseract.js,
 * em português). Muitos estão de lado: a imagem é girada (0°, 90°, 270°, 180°) até o texto fazer sentido.
 * O texto lido da imagem é usado SÓ para achar a data (o curso continua pelo nome do arquivo).
 */

// CommonJS sem tipos completos: só o que é usado aqui.
/* eslint-disable @typescript-eslint/no-require-imports */
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (o: { data: Buffer }) => {
    getScreenshot(o?: { first?: number; scale?: number; imageDataUrl?: boolean }): Promise<{ pages: Array<{ data: Uint8Array }> }>;
    destroy(): Promise<void>;
  };
};
const { createCanvas, loadImage } = require('@napi-rs/canvas') as {
  createCanvas(w: number, h: number): {
    width: number; height: number; toBuffer(tipo: 'image/png'): Buffer;
    getContext(t: '2d'): { translate(x: number, y: number): void; rotate(a: number): void; drawImage(i: unknown, x: number, y: number, w?: number, h?: number): void };
  };
  loadImage(dados: Buffer | Uint8Array): Promise<{ width: number; height: number }>;
};
const { createWorker } = require('tesseract.js') as {
  createWorker(lang: string, oem: number, opts: Record<string, unknown>): Promise<{
    recognize(img: Buffer): Promise<{ data: { text: string; confidence: number } }>;
    terminate(): Promise<void>;
  }>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Páginas lidas por certificado (título e data ficam no começo). */
const PAGINAS = 2;
/** Lado maior da imagem lida: grande o bastante para ler, pequeno para não pesar na VM. */
const LADO_MAXIMO = 2200;
/** Confiança mínima (0–100) para aceitar uma posição de giro sem testar as outras. */
const CONFIANCA_BOA = 75;
const PARECE_CERTIFICADO = /certific|conclu|curso|trein|realizad|carga hor|nome|data/i;

/** O texto que o pdf-parse devolve de um PDF que é figura: só as marcas "-- 1 of 2 --". */
export function semTexto(texto: string | null | undefined): boolean {
  return !(texto ?? '').replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '').trim();
}

export class LeitorOcr {
  private readonly logger = new Logger('LeitorOcr');
  private worker: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;
  /** Uma leitura de cada vez: OCR usa muita CPU, e a VM é pequena. */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private readonly pastaDados: string) {}

  /** Texto das primeiras páginas de um PDF que é figura. '' se não conseguir. */
  lerPdf(dados: Buffer): Promise<string> {
    return this.emFila(async () => {
      const parser = new PDFParse({ data: dados });
      try {
        const { pages } = await parser.getScreenshot({ first: PAGINAS, scale: 2, imageDataUrl: false });
        const textos: string[] = [];
        for (const pagina of pages) textos.push(await this.lerImagem(Buffer.from(pagina.data)));
        return textos.join('\n').trim();
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    });
  }

  /** Texto de uma imagem (JPG/PNG) de certificado. */
  lerFoto(dados: Buffer): Promise<string> {
    return this.emFila(() => this.lerImagem(dados));
  }

  async encerrar() {
    if (this.worker) await (await this.worker).terminate().catch(() => undefined);
    this.worker = null;
  }

  private emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const vez = this.fila.then(tarefa, tarefa);
    this.fila = vez.catch(() => undefined);
    return vez;
  }

  private obterWorker() {
    if (!this.worker) {
      const cache = resolve(join(this.pastaDados, 'tessdata'));
      mkdirSync(cache, { recursive: true });
      // O modelo de português é baixado uma vez e fica guardado em `cache`.
      this.worker = createWorker('por', 1, { cachePath: cache, logger: () => undefined, errorHandler: () => undefined })
        .catch(erro => { this.worker = null; throw erro; });
    }
    return this.worker;
  }

  /** Lê a imagem girando até o texto fazer sentido; fica com a posição de maior confiança. */
  private async lerImagem(dados: Buffer): Promise<string> {
    const worker = await this.obterWorker();
    const imagem = await loadImage(dados);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const largura = Math.round(imagem.width * escala);
    const altura = Math.round(imagem.height * escala);
    let melhor = { texto: '', confianca: -1 };
    for (const giro of [0, 90, 270, 180]) {
      const deitado = giro % 180 !== 0;
      const tela = createCanvas(deitado ? altura : largura, deitado ? largura : altura);
      const ctx = tela.getContext('2d');
      ctx.translate(tela.width / 2, tela.height / 2);
      ctx.rotate((giro * Math.PI) / 180);
      ctx.drawImage(imagem, -largura / 2, -altura / 2, largura, altura);
      const { data } = await worker.recognize(tela.toBuffer('image/png'));
      const texto = data.text.replace(/[ \t]+/g, ' ').trim();
      if (data.confidence > melhor.confianca) melhor = { texto, confianca: data.confidence };
      if (data.confidence >= CONFIANCA_BOA && PARECE_CERTIFICADO.test(texto)) break;
    }
    this.logger.debug(`OCR: confiança ${Math.round(melhor.confianca)}`);
    return melhor.confianca >= 40 ? melhor.texto : '';
  }
}
