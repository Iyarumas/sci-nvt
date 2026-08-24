import { useEffect, useState, type CSSProperties } from 'react';
import { MousePointer2, X } from 'lucide-react';

export type AnimatedTourStep = {
  target?: string;
  selector?: string;
  title: string;
  body: string;
  detail: string;
};

type TourRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;

function isVisibleElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function queryVisibleElement(selector: string): HTMLElement | null {
  try {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find(isVisibleElement) || null;
  } catch {
    return null;
  }
}

function getTargetElement(targetAttribute: string, step: AnimatedTourStep): HTMLElement | null {
  if (step.selector) return queryVisibleElement(step.selector);
  if (!step.target) return null;
  return queryVisibleElement(`[${targetAttribute}="${step.target}"]`);
}

function getTargetRect(targetAttribute: string, step: AnimatedTourStep): DOMRect | null {
  return getTargetElement(targetAttribute, step)?.getBoundingClientRect() || null;
}

function fallbackTourRect(): TourRect {
  const width = Math.min(320, window.innerWidth - 32);
  const height = 112;
  const left = (window.innerWidth - width) / 2;
  const top = Math.max(80, (window.innerHeight - height) / 2);
  return { top, left, right: left + width, bottom: top + height, width, height };
}

function normalizeTourRect(rect: TourRect): TourRect {
  const margin = 16;
  const maxWidth = Math.max(80, window.innerWidth - margin * 2);
  const maxHeight = Math.max(80, Math.min(window.innerHeight - margin * 2, 260));
  const width = Math.min(Math.max(rect.width, 80), maxWidth);
  const height = Math.min(Math.max(rect.height, 56), maxHeight);
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));

  return { top, left, right: left + width, bottom: top + height, width, height };
}

function overlapArea(a: TourRect, b: TourRect): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function tourPanelStyle(rect: TourRect): CSSProperties {
  const margin = 16;
  const width = Math.min(window.innerWidth < 700 ? window.innerWidth - margin * 2 : window.innerWidth < 1100 ? 460 : 520, window.innerWidth - margin * 2);
  const estimatedHeight = Math.min(window.innerWidth < 700 ? window.innerHeight * 0.72 : 520, window.innerHeight - margin * 2);
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - estimatedHeight - margin;

  if (window.innerWidth < 700) {
    return { left: margin, right: margin, bottom: margin, maxHeight: estimatedHeight };
  }

  const candidates = [
    { left: rect.right + 20, top: rect.top },
    { left: rect.left - width - 20, top: rect.top },
    { left: rect.left, top: rect.bottom + 20 },
    { left: rect.left, top: rect.top - estimatedHeight - 20 },
    { left: window.innerWidth - width - margin, top: window.innerHeight - estimatedHeight - margin },
  ].map(candidate => {
    const left = clamp(candidate.left, margin, maxLeft);
    const top = clamp(candidate.top, margin, Math.max(margin, maxTop));
    const panelRect = { top, left, right: left + width, bottom: top + estimatedHeight, width, height: estimatedHeight };
    return { left, top, overlap: overlapArea(panelRect, rect) };
  });

  const best = candidates.sort((a, b) => a.overlap - b.overlap)[0];
  return { left: best.left, top: best.top, width, maxHeight: estimatedHeight };
}

export function AnimatedPageTour({
  open,
  steps,
  stepIndex,
  targetAttribute,
  detailLabel = 'Como funciona',
  onBack,
  onNext,
  onClose,
}: {
  open: boolean;
  steps: AnimatedTourStep[];
  stepIndex: number;
  targetAttribute: string;
  detailLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex] || steps[0];

  useEffect(() => {
    if (!open || !step) return;

    setRect(null);
    const element = getTargetElement(targetAttribute, step);
    element?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    const updateRect = () => setRect(getTargetRect(targetAttribute, step));
    const timers = [
      window.setTimeout(updateRect, 80),
      window.setTimeout(updateRect, 380),
      window.setTimeout(updateRect, 720),
    ];

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    updateRect();

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, step, targetAttribute]);

  if (!open || !step) return null;

  const targetRect = normalizeTourRect(rect || fallbackTourRect());
  const panelStyle = tourPanelStyle(targetRect);
  const spotlightPadding = 14;
  const spotlightStyle: CSSProperties = {
    top: targetRect.top - spotlightPadding,
    left: targetRect.left - spotlightPadding,
    width: targetRect.width + spotlightPadding * 2,
    height: targetRect.height + spotlightPadding * 2,
  };
  const cursorStyle: CSSProperties = {
    top: targetRect.top + targetRect.height / 2,
    left: targetRect.left + targetRect.width / 2,
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="fixed rounded-2xl border-2 border-aviation-300 bg-white/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.58),0_0_0_8px_rgba(14,116,144,0.16),0_18px_50px_rgba(14,116,144,0.35)] transition-all duration-700 ease-out"
        style={spotlightStyle}
      />
      <span
        className="fixed z-[61] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-aviation-300 bg-aviation-400/20 opacity-70 animate-ping"
        style={cursorStyle}
      />
      <MousePointer2
        className="fixed z-[62] h-9 w-9 -translate-x-1 -translate-y-1 animate-bounce text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] transition-all duration-700 ease-out"
        style={cursorStyle}
        fill="white"
      />

      <div
        className="pointer-events-auto fixed z-[63] overflow-y-auto rounded-2xl border border-graphite-200 bg-white p-6 shadow-2xl shadow-black/25 dark:border-border-dark dark:bg-surface-card"
        style={panelStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
              Passo {stepIndex + 1} de {steps.length}
            </span>
            <h3 className="mt-1 text-xl font-bold text-graphite-900 dark:text-graphite-100">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
            title="Pular tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[15px] leading-7 text-graphite-600 dark:text-graphite-300">{step.body}</p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[15px] leading-7 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="font-bold">{detailLabel}: </span>{step.detail}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover/50"
          >
            Pular
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600"
            >
              {stepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
