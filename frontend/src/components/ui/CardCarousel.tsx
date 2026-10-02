import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

type CardCarouselProps = {
  pages: ReactNode[];
  ariaLabel: string;
  resetKey: string | number;
};

type MouseDrag = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  startPage: number;
  moved: boolean;
};

export default function CardCarousel({ pages, ariaLabel, resetKey }: CardCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activePageRef = useRef(0);
  const previousResetKeyRef = useRef(resetKey);
  const dragRef = useRef<MouseDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [activePage, setActivePage] = useState(0);
  const [dragging, setDragging] = useState(false);

  function updateActivePage(index: number) {
    const nextPage = Math.max(0, Math.min(index, pages.length - 1));
    activePageRef.current = nextPage;
    setActivePage(nextPage);
  }

  function scrollToPage(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextPage = Math.max(0, Math.min(index, pages.length - 1));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({ left: nextPage * viewport.clientWidth, behavior: reduceMotion ? 'instant' : 'smooth' });
    if (reduceMotion) updateActivePage(nextPage);
  }

  useEffect(() => {
    const reset = previousResetKeyRef.current !== resetKey;
    previousResetKeyRef.current = resetKey;
    const nextPage = reset ? 0 : Math.max(0, Math.min(activePageRef.current, pages.length - 1));
    activePageRef.current = nextPage;
    setActivePage(nextPage);
    dragRef.current = null;
    setDragging(false);
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ left: nextPage * viewport.clientWidth, behavior: 'instant' });
  }, [resetKey, pages.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!dragRef.current?.moved) {
        viewport.scrollTo({ left: activePageRef.current * viewport.clientWidth, behavior: 'instant' });
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [pages.length]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (pages.length < 2 || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      startPage: activePageRef.current,
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const movement = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(movement) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.scrollSnapType = 'none';
      setDragging(true);
    }
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    event.currentTarget.scrollLeft = drag.startScrollLeft - movement;
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.style.scrollSnapType = 'x mandatory';
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    const viewport = event.currentTarget;
    const distance = viewport.scrollLeft - drag.startScrollLeft;
    let nextPage = Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth));
    if (nextPage === drag.startPage && Math.abs(distance) > Math.max(40, viewport.clientWidth * 0.15)) {
      nextPage += Math.sign(distance);
    }
    scrollToPage(nextPage);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || pages.length < 2) return;
    const nextPages: Record<string, number> = {
      ArrowLeft: activePageRef.current - 1,
      ArrowRight: activePageRef.current + 1,
      Home: 0,
      End: pages.length - 1,
    };
    if (!(event.key in nextPages)) return;
    event.preventDefault();
    scrollToPage(nextPages[event.key]);
  }

  if (!pages.length) return null;

  return (
    <div role="region" aria-roledescription="carrossel" aria-label={ariaLabel} className="min-w-0">
      <div
        ref={viewportRef}
        tabIndex={pages.length > 1 ? 0 : -1}
        aria-label={`Navegar em ${ariaLabel}`}
        className={`flex min-w-0 overflow-x-auto overscroll-x-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aviation-500 ${pages.length > 1 ? (dragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''}`}
        style={{ scrollSnapType: dragging ? 'none' : 'x mandatory' }}
        onScroll={event => updateActivePage(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={() => { if (!dragRef.current?.moved) dragRef.current = null; }}
        onLostPointerCapture={finishDrag}
        onDragStart={event => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onClickCapture={event => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {pages.map((page, index) => (
          <div
            key={index}
            role="group"
            aria-roledescription="página"
            aria-label={`Página ${index + 1} de ${pages.length}`}
            aria-hidden={index !== activePage}
            inert={index !== activePage}
            className="min-w-0 basis-full shrink-0 snap-start [scroll-snap-stop:always]"
          >
            {page}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1" aria-label={`Páginas de ${ariaLabel}`}>
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Página ${index + 1} de ${pages.length}`}
              aria-current={index === activePage ? 'page' : undefined}
              onClick={() => scrollToPage(index)}
              className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aviation-500"
            >
              <span className={`h-2 rounded-full transition-all motion-reduce:transition-none ${index === activePage ? 'w-5 bg-aviation-600 dark:bg-aviation-400' : 'w-2 bg-graphite-300 hover:bg-graphite-400 dark:bg-graphite-600 dark:hover:bg-graphite-400'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
