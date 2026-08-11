import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - pdfjs-dist worker types
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';

(globalThis as any).pdfjsWorker = { WorkerMessageHandler };

export default pdfjsLib;
