import { useState, useEffect } from 'react';
import {
  Type, Minus, Square, Eraser, Save, ArrowLeft,
  Undo2, Redo2, MousePointer,
} from 'lucide-react';
import pdfjsLib from '../../lib/pdfjs-setup';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type AnnotationType = 'select' | 'text' | 'line' | 'rectangle' | 'erase';

export interface PdfAnnotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  x2: number;
  y2: number;
  page: number;
  text?: string;
  fontSize?: number;
  fontColor?: string;
  lineWidth?: number;
  lineColor?: string;
}

interface Props {
  pdfData: ArrayBuffer;
  initialAnnotations?: PdfAnnotation[];
  onSave: (annotations: PdfAnnotation[]) => void;
  onBack: () => void;
  pageTitle?: string;
}

export function PdfEditor({ pdfData, initialAnnotations = [], onSave, onBack, pageTitle }: Props) {
  const [tool, setTool] = useState<AnnotationType>('select');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>(initialAnnotations);
  const [history, setHistory] = useState<PdfAnnotation[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [fontColor, setFontColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineColor, setLineColor] = useState('#000000');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const doc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Erro ao carregar PDF no editor:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfData]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1.5 });
      setPageWidth(viewport.width);
      setPageHeight(viewport.height);

      const canvas = document.getElementById('pdf-editor-canvas') as HTMLCanvasElement;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      if (cancelled) return;

      const maxW = window.innerWidth - 64;
      const maxH = window.innerHeight - 140;
      const scaleW = maxW / viewport.width;
      const scaleH = maxH / viewport.height;
      setDisplayScale(Math.min(scaleW, scaleH, 1));
    })();
    return () => { cancelled = true; };
  }, [pdf, currentPage]);

  useEffect(() => {
    const overlay = document.getElementById('pdf-editor-overlay') as HTMLCanvasElement;
    if (!overlay || !pageWidth) return;
    overlay.width = pageWidth;
    overlay.height = pageHeight;
    drawOverlay();
  }, [annotations, selectedId, pageWidth, pageHeight]);

  function drawOverlay() {
    const overlay = document.getElementById('pdf-editor-overlay') as HTMLCanvasElement;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const ann of annotations) {
      ctx.save();
      if (ann.id === selectedId) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        const sx = Math.min(ann.x, ann.x2);
        const sy = Math.min(ann.y, ann.y2);
        const sw = Math.abs(ann.x2 - ann.x);
        const sh = Math.abs(ann.y2 - ann.y);
        ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
        ctx.setLineDash([]);
      }

      switch (ann.type) {
        case 'text': {
          ctx.fillStyle = ann.fontColor || '#000000';
          ctx.font = `${ann.fontSize || 14}px Helvetica`;
          ctx.fillText(ann.text || '', ann.x, ann.y);
          break;
        }
        case 'line': {
          ctx.strokeStyle = ann.lineColor || '#000000';
          ctx.lineWidth = ann.lineWidth || 2;
          ctx.beginPath();
          ctx.moveTo(ann.x, ann.y);
          ctx.lineTo(ann.x2, ann.y2);
          ctx.stroke();
          break;
        }
        case 'rectangle': {
          ctx.strokeStyle = ann.lineColor || '#000000';
          ctx.lineWidth = ann.lineWidth || 2;
          const rx = Math.min(ann.x, ann.x2);
          const ry = Math.min(ann.y, ann.y2);
          const rw = Math.abs(ann.x2 - ann.x);
          const rh = Math.abs(ann.y2 - ann.y);
          ctx.strokeRect(rx, ry, rw, rh);
          break;
        }
        case 'erase': {
          ctx.fillStyle = '#ffffff';
          const ex = Math.min(ann.x, ann.x2);
          const ey = Math.min(ann.y, ann.y2);
          const ew = Math.abs(ann.x2 - ann.x);
          const eh = Math.abs(ann.y2 - ann.y);
          ctx.fillRect(ex, ey, ew, eh);
          break;
        }
      }
      ctx.restore();
    }
  }

  function pushHistory(newAnnotations: PdfAnnotation[]) {
    const h = history.slice(0, historyIndex + 1);
    h.push(newAnnotations);
    setHistory(h);
    setHistoryIndex(h.length - 1);
  }

  function undo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getCanvasPos(e);

    if (tool === 'select') {
      const clicked = [...annotations].reverse().find(ann => {
        const sx = Math.min(ann.x, ann.x2);
        const sy = Math.min(ann.y, ann.y2);
        const sw = Math.abs(ann.x2 - ann.x);
        const sh = Math.abs(ann.y2 - ann.y);
        return pos.x >= sx && pos.x <= sx + sw && pos.y >= sy && pos.y <= sy + sh;
      });
      setSelectedId(clicked?.id || null);
      return;
    }

    if (tool === 'text') {
      setTextPos(pos);
      setTextInput('');
      setShowTextInput(true);
      return;
    }

    setDrawing(true);
    setStartPos(pos);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !startPos) return;
    const overlay = document.getElementById('pdf-editor-overlay') as HTMLCanvasElement;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    const pos = getCanvasPos(e);

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawOverlay();

    ctx.save();
    if (tool === 'line') {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(
        Math.min(startPos.x, pos.x), Math.min(startPos.y, pos.y),
        Math.abs(pos.x - startPos.x), Math.abs(pos.y - startPos.y)
      );
    } else if (tool === 'erase') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        Math.min(startPos.x, pos.x), Math.min(startPos.y, pos.y),
        Math.abs(pos.x - startPos.x), Math.abs(pos.y - startPos.y)
      );
    }
    ctx.restore();
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !startPos) return;
    const pos = getCanvasPos(e);
    setDrawing(false);

    const w = Math.abs(pos.x - startPos.x);
    const h = Math.abs(pos.y - startPos.y);
    if (w < 3 && h < 3) { setStartPos(null); return; }

    const newAnn: PdfAnnotation = {
      id: crypto.randomUUID(),
      type: tool,
      x: startPos.x, y: startPos.y,
      x2: pos.x, y2: pos.y,
      page: currentPage,
      lineWidth, lineColor,
    };
    const next = [...annotations, newAnn];
    setAnnotations(next);
    pushHistory(next);
    setStartPos(null);
  }

  function addTextAnnotation() {
    if (!textInput.trim() || !textPos) return;
    const newAnn: PdfAnnotation = {
      id: crypto.randomUUID(),
      type: 'text',
      x: textPos.x, y: textPos.y,
      x2: textPos.x + 200, y2: textPos.y + fontSize,
      page: currentPage,
      text: textInput, fontSize, fontColor,
    };
    const next = [...annotations, newAnn];
    setAnnotations(next);
    pushHistory(next);
    setTextInput('');
    setShowTextInput(false);
    setTextPos(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const next = annotations.filter(a => a.id !== selectedId);
    setAnnotations(next);
    pushHistory(next);
    setSelectedId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedId && !showTextInput) { e.preventDefault(); deleteSelected(); }
    }
    if (e.key === 'Escape') { setShowTextInput(false); setSelectedId(null); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  }

  const toolDefs: { type: AnnotationType; icon: any; label: string }[] = [
    { type: 'select', icon: MousePointer, label: 'Selecionar' },
    { type: 'text', icon: Type, label: 'Texto' },
    { type: 'line', icon: Minus, label: 'Linha' },
    { type: 'rectangle', icon: Square, label: 'Retangulo' },
    { type: 'erase', icon: Eraser, label: 'Apagar' },
  ];

  const dw = pageWidth * displayScale;
  const dh = pageHeight * displayScale;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col outline-none" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center gap-2 border-b border-graphite-200 bg-white px-4 py-2 dark:border-graphite-700 dark:bg-graphite-800">
        <button onClick={onBack}
          className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
          <ArrowLeft className="inline h-4 w-4 mr-1" />Voltar
        </button>
        <h3 className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{pageTitle || 'Editor de PDF'}</h3>

        <div className="flex items-center gap-1 border-l border-graphite-200 pl-4 dark:border-graphite-700">
          {toolDefs.map(t => (
            <button key={t.type} onClick={() => setTool(t.type)} title={t.label}
              className={`rounded p-2 ${tool === t.type
                ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300'
                : 'text-graphite-500 hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-graphite-700'
              }`}>
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-graphite-200 pl-4 dark:border-graphite-700">
          <button onClick={undo} disabled={historyIndex <= 0} title="Desfazer"
            className="rounded p-2 text-graphite-500 hover:bg-graphite-100 disabled:opacity-30 dark:hover:bg-graphite-700">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Refazer"
            className="rounded p-2 text-graphite-500 hover:bg-graphite-100 disabled:opacity-30 dark:hover:bg-graphite-700">
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {tool === 'text' && (
          <div className="flex items-center gap-2 border-l border-graphite-200 pl-4 dark:border-graphite-700">
            <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
              className="w-14 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200" min={6} max={72} />
            <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0" />
          </div>
        )}

        {(tool === 'line' || tool === 'rectangle') && (
          <div className="flex items-center gap-2 border-l border-graphite-200 pl-4 dark:border-graphite-700">
            <input type="number" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}
              className="w-14 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200" min={1} max={20} />
            <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0" />
          </div>
        )}

        {selectedId && (
          <button onClick={deleteSelected}
            className="rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
            Excluir
          </button>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-2 border-l border-graphite-200 pl-4 dark:border-graphite-700">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="rounded border border-graphite-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-graphite-700">&lt;</button>
            <span className="text-xs text-graphite-600 dark:text-graphite-300">{currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="rounded border border-graphite-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-graphite-700">&gt;</button>
          </div>
        )}

        <div className="ml-auto">
          <button onClick={() => onSave(annotations)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700">
            <Save className="h-3 w-3" /> Salvar Edicoes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-graphite-300 dark:bg-graphite-900 flex justify-center pt-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center text-sm text-graphite-500">Carregando PDF...</div>
        ) : (
          <div className="relative inline-block shadow-lg" style={{ width: dw, height: dh }}>
            <canvas id="pdf-editor-canvas" style={{ width: dw, height: dh, display: 'block' }} />
            <canvas id="pdf-editor-overlay"
              style={{
                position: 'absolute', left: 0, top: 0,
                width: dw, height: dh, display: 'block',
                cursor: tool === 'select' ? 'default' : 'crosshair',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </div>
        )}
      </div>

      {showTextInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-graphite-800">
            <h3 className="mb-4 text-lg font-semibold text-graphite-900 dark:text-graphite-100">Inserir Texto</h3>
            <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
              placeholder="Digite o texto..."
              className="mb-3 w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addTextAnnotation(); if (e.key === 'Escape') setShowTextInput(false); }} />
            <div className="mb-4 flex items-center gap-3">
              <label className="text-xs text-graphite-500">Tamanho:</label>
              <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                className="w-16 rounded border border-graphite-200 px-2 py-1 text-xs dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200" min={6} max={72} />
              <label className="text-xs text-graphite-500">Cor:</label>
              <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border-0" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowTextInput(false)}
                className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200">
                Cancelar
              </button>
              <button onClick={addTextAnnotation} disabled={!textInput.trim()}
                className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                Inserir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
