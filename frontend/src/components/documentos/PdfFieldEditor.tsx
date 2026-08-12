import { useEffect, useRef, useState, useCallback } from 'react';
import { Package } from 'lucide-react';
import pdfjsLib from '../../lib/pdfjs-setup';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentField } from '../../types/document';

interface Props {
  pdfData: ArrayBuffer;
  fields: DocumentField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (id: string, updates: Partial<DocumentField>) => void;
  onCommitField?: (id: string, updates: Partial<DocumentField>) => void;
  onAddField: (field: Omit<DocumentField, 'id' | 'created_at'>) => void;
  onDropFromTray?: (fieldId: string, x: number, y: number, page: number) => void;
  onReturnToTray?: (fieldId: string) => void;
  documentId: string;
}

interface FieldDragState {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface FieldResizeState {
  id: string;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  handle: 'se' | 'sw' | 'ne' | 'nw';
}

interface PageDimensions {
  width: number;
  height: number;
  scale: number;
}

export function PdfFieldEditor({
  pdfData,
  fields,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onCommitField,
  onAddField,
  onDropFromTray,
  onReturnToTray,
  documentId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null);
  const [dragState, setDragState] = useState<FieldDragState | null>(null);
  const [resizeState, setResizeState] = useState<FieldResizeState | null>(null);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load PDF
  useEffect(() => {
    if (!pdfData) return;
    let cancelled = false;
    setLoadError(null);
    setPdf(null);
    setPageDims(null);

    (async () => {
      try {
        const data = pdfData.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Erro ao carregar PDF:', err);
        if (!cancelled) setLoadError(String(err));
      }
    })();

    return () => { cancelled = true; };
  }, [pdfData]);

  // Render current page
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;

    (async () => {
      try {
        setRendering(true);
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('Canvas ref não disponível');
          setRendering(false);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Não foi possível obter contexto 2D do canvas');
          setRendering(false);
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport } as any).promise;

        if (cancelled) return;

        const container = containerRef.current;
        if (container) {
          const containerWidth = container.clientWidth - 32;
          if (containerWidth > 0) {
            const scale = containerWidth / viewport.width;
            setPageDims({
              width: viewport.width,
              height: viewport.height,
              scale,
            });
          } else {
            console.warn('Container sem largura, tentando com scale 1');
            setPageDims({
              width: viewport.width,
              height: viewport.height,
              scale: 1,
            });
          }
        }
      } catch (err) {
        console.error('Erro ao renderizar página do PDF:', err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdf, currentPage]);

  // Drag handlers
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    setDragState({
      id: fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
    });
    onSelectField(fieldId);
  }, [fields, onSelectField]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, fieldId: string, handle: 'se' | 'sw' | 'ne' | 'nw') => {
    e.stopPropagation();
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    setResizeState({
      id: fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origW: field.width,
      origH: field.height,
      handle,
    });
  }, [fields]);

  useEffect(() => {
    if (!dragState || !pageDims) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / pageDims.scale;
      const dy = (e.clientY - dragState.startY) / pageDims.scale;
      const newX = Math.max(0, dragState.origX + dx);
      const newY = Math.max(0, dragState.origY + dy);
      onUpdateField(dragState.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      const field = fields.find(f => f.id === dragState.id);
      if (field && onCommitField) {
        onCommitField(dragState.id, { x: field.x, y: field.y });
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pageDims, onUpdateField, onCommitField, fields]);

  useEffect(() => {
    if (!resizeState || !pageDims) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeState.startX) / pageDims.scale;
      const dy = (e.clientY - resizeState.startY) / pageDims.scale;
      let newW = resizeState.origW;
      let newH = resizeState.origH;

      if (resizeState.handle === 'se') {
        newW = Math.max(30, resizeState.origW + dx);
        newH = Math.max(16, resizeState.origH + dy);
      } else if (resizeState.handle === 'sw') {
        newW = Math.max(30, resizeState.origW - dx);
        newH = Math.max(16, resizeState.origH + dy);
      } else if (resizeState.handle === 'ne') {
        newW = Math.max(30, resizeState.origW + dx);
        newH = Math.max(16, resizeState.origH - dy);
      } else if (resizeState.handle === 'nw') {
        newW = Math.max(30, resizeState.origW - dx);
        newH = Math.max(16, resizeState.origH - dy);
      }
      onUpdateField(resizeState.id, { width: newW, height: newH });
    };

    const handleMouseUp = () => {
      const field = fields.find(f => f.id === resizeState.id);
      if (field && onCommitField) {
        onCommitField(resizeState.id, { width: field.width, height: field.height });
      }
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, pageDims, onUpdateField, onCommitField, fields]);

  // Add field on double-click on empty area
  function handleCanvasDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('.pdf-field-box')) return;
    if (!pageDims) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageDims.scale;
    const y = (e.clientY - rect.top) / pageDims.scale;

    const existingOnPage = fields.filter(f => f.page === currentPage);
    const newIdx = existingOnPage.length;

    onAddField({
      document_id: documentId,
      field_name: `campo_${Date.now()}`,
      field_label: 'Novo Campo',
      field_type: 'text',
      required: false,
      placeholder: '',
      options: null,
      order_index: fields.length + newIdx,
      page: currentPage,
      x,
      y,
      width: 150,
      height: 20,
      font_size: 10,
      data_source: 'manual',
      is_signature: false,
      signer_role: null,
      read_only: false,
      conditional_on: null,
    });
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Erro ao carregar PDF</p>
          <p className="mt-1 text-xs text-graphite-400">{loadError}</p>
        </div>
      </div>
    );
  }

  const showCanvas = !!pdf;
  const displayWidth = pageDims ? pageDims.width * pageDims.scale : 0;
  const displayHeight = pageDims ? pageDims.height * pageDims.scale : 0;
  const pageFields = fields.filter(f => f.page === currentPage);

  return (
    <div className="flex gap-4">
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="flex justify-center pb-4">
          <div
            className="relative inline-block"
            style={pageDims ? { width: displayWidth, height: displayHeight } : undefined}
            onDoubleClick={handleCanvasDoubleClick}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              e.preventDefault();
              const fieldId = e.dataTransfer.getData('text/field-id');
              if (!fieldId || !onDropFromTray || !pageDims) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / pageDims.scale;
              const y = (e.clientY - rect.top) / pageDims.scale;
              onDropFromTray(fieldId, Math.max(0, x), Math.max(0, y), currentPage);
            }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('.pdf-field-box')) {
                onSelectField(null);
              }
            }}
          >
            <canvas
              ref={canvasRef}
              className="block shadow-lg"
              style={pageDims ? { width: displayWidth, height: displayHeight } : { display: 'block' }}
            />

            {showCanvas && pageDims && pageFields.map(field => {
              const isSelected = field.id === selectedFieldId;
              return (
                <div
                  key={field.id}
                  className={`pdf-field-box absolute cursor-move overflow-hidden border-2 ${
                    field.is_signature
                      ? 'border-purple-400 bg-purple-100/50'
                      : isSelected
                      ? 'border-aviation-500 bg-aviation-100/50'
                      : 'border-dashed border-graphite-400 bg-yellow-50/70'
                  } ${isSelected ? 'ring-2 ring-aviation-300' : ''}`}
                  style={{
                    left: field.x * pageDims!.scale,
                    top: field.y * pageDims!.scale,
                    width: field.width * pageDims!.scale,
                    height: field.height * pageDims!.scale,
                    fontSize: field.font_size * pageDims!.scale,
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                >
                  <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden px-1">
                    <span className="truncate text-xs font-medium text-graphite-700">
                      {field.field_name.startsWith('check_') ? '✓' : field.is_signature ? `✎ ${field.field_label}` : field.field_label}
                    </span>
                  </div>

                  {isSelected && (
                    <>
                      {onReturnToTray && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onReturnToTray(field.id); }}
                          className="absolute -top-5 right-0 z-10 flex items-center gap-1 rounded bg-graphite-700 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg hover:bg-graphite-600"
                          title="Devolver à Bandeja"
                        >
                          <Package className="h-3 w-3" /> Bandeja
                        </button>
                      )}
                      <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-aviation-500" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')} />
                      <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-sw-resize rounded-sm border border-white bg-aviation-500" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')} />
                      <div className="absolute -top-1.5 -right-1.5 h-3 w-3 cursor-ne-resize rounded-sm border border-white bg-aviation-500" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')} />
                      <div className="absolute -top-1.5 -left-1.5 h-3 w-3 cursor-nw-resize rounded-sm border border-white bg-aviation-500" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')} />
                    </>
                  )}
                </div>
              );
            })}

            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <span className="text-sm text-graphite-500">Renderizando...</span>
              </div>
            )}

            {!showCanvas && !loadError && (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-graphite-400">Carregando PDF...</span>
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
              ← Anterior
            </button>
            <span className="text-sm text-graphite-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
