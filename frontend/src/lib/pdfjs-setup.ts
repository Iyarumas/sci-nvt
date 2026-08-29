import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - pdfjs-dist worker types vary between installed versions.
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';

(globalThis as any).pdfjsWorker = { WorkerMessageHandler };

export default pdfjsLib;
