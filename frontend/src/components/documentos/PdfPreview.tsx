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
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    (async () => {
      const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
    })();
  }, [pdfData]);

  useEffect(() => {
    if (!pdf) return;
    (async () => {
      setRendering(true);
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.getElementById('pdf-preview-canvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      const container = containerRef.current;
      if (container) {
        const containerWidth = container.clientWidth - 32;
        const scale = containerWidth / viewport.width;
        setPageDims({ width: viewport.width, height: viewport.height, scale });
      }
      setRendering(false);
    })();
  }, [pdf, currentPage]);

  if (!pageDims) {
    return <div className="flex items-center justify-center py-12 text-graphite-400">Carregando PDF...</div>;
  }

  const displayWidth = pageDims.width * pageDims.scale;
  const displayHeight = pageDims.height * pageDims.scale;
  const pageFields = fields.filter(f => f.page === currentPage && (f.x !== 0 || f.y !== 0));

  return (
    <div className="flex gap-4">
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="flex justify-center pb-4">
          <div
            className="relative inline-block"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <canvas
              id="pdf-preview-canvas"
              className="block shadow-lg"
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
                  left: field.x * pageDims.scale,
                  top: field.y * pageDims.scale,
                  width: field.width * pageDims.scale,
                  height: field.height * pageDims.scale,
                  fontSize: field.font_size * pageDims.scale,
                }}
              >
                <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden px-1">
                  <span className="truncate text-xs font-semibold text-red-600">
                    {field.is_signature ? `✎ ${field.field_label}` : field.field_label}
                  </span>
                </div>
              </div>
            ))}

            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <span className="text-sm text-graphite-500">Renderizando...</span>
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
