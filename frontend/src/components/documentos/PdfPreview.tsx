import { useEffect, useRef, useState } from 'react';
import pdfjsLib from '../../lib/pdfjs-setup';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentField } from '../../types/document';



interface Props {
  pdfData: ArrayBuffer;
  fields: DocumentField[];
}

interface PageDimensions {
  width: number;
  height: number;
  scale: number;
}

export function PdfPreview({ pdfData, fields }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPdf(null);
        setPageDims(null);
        setTotalPages(0);
        setCurrentPage(1);
        setError('');
        const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
      } catch {
        if (!cancelled) setError('Não foi possível carregar o PDF.');
      }
    })();

    return () => { cancelled = true; };
  }, [pdfData]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      try {
        setRendering(true);
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const outputScale = Math.max(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        } as any).promise;
        if (cancelled) return;

        const container = containerRef.current;
        const containerWidth = Math.max(320, (container?.clientWidth || viewport.width) - 32);
        const scale = Math.min(1, containerWidth / viewport.width);
        setPageDims({ width: viewport.width, height: viewport.height, scale });
      } catch {
        if (!cancelled) setError('Não foi possível renderizar o PDF.');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdf, currentPage]);

  if (error) {
    return <div className="flex items-center justify-center py-12 text-sm text-alert-red">{error}</div>;
  }

  const displayWidth = pageDims ? pageDims.width * pageDims.scale : 360;
  const displayHeight = pageDims ? pageDims.height * pageDims.scale : 510;
  const pageScale = pageDims?.scale ?? 1;
  const pageFields = pageDims ? fields.filter(f => f.page === currentPage && (f.x !== 0 || f.y !== 0)) : [];

  return (
    <div className="flex gap-4">
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="flex justify-center pb-4">
          <div
            className="relative inline-block"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <canvas
              ref={canvasRef}
              id="pdf-preview-canvas"
              className={`block bg-white shadow-lg ${pageDims ? '' : 'opacity-0'}`}
              style={{ width: displayWidth, height: displayHeight }}
            />

            {pageFields.map(field => (
              <div
                key={field.id}
                className={`absolute border-2 pointer-events-none ${
                  field.is_signature
                    ? 'border-red-500 bg-red-100/40'
                    : 'border-red-400 bg-red-50/40'
                }`}
                style={{
                  left: field.x * pageScale,
                  top: field.y * pageScale,
                  width: field.width * pageScale,
                  height: field.height * pageScale,
                  fontSize: field.font_size * pageScale,
                }}
              >
                <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden px-1">
                  <span className="truncate text-xs font-semibold text-red-600">
                    {field.is_signature ? `✎ ${field.field_label}` : field.field_label}
                  </span>
                </div>
              </div>
            ))}

            {(!pageDims || rendering) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <span className="text-sm text-graphite-500">{pageDims ? 'Renderizando...' : 'Carregando PDF...'}</span>
              </div>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pb-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm text-graphite-600">
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
