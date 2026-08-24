import { useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { AnimatedPageTour, type AnimatedTourStep } from './AnimatedPageTour';

export function PageTour({
  steps,
  targetAttribute,
  title,
  detailLabel,
}: {
  steps: AnimatedTourStep[];
  targetAttribute: string;
  title: string;
  detailLabel?: string;
}) {
  const origemRef = useRef<{ scrollY: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  function openTour() {
    origemRef.current = { scrollY: window.scrollY };
    setStepIndex(0);
    setOpen(true);
  }

  function closeTour() {
    const origem = origemRef.current;
    setOpen(false);
    setStepIndex(0);
    if (origem) {
      window.setTimeout(() => window.scrollTo({ top: origem.scrollY, behavior: 'smooth' }), 50);
    }
    origemRef.current = null;
  }

  function back() {
    setStepIndex(index => Math.max(0, index - 1));
  }

  function next() {
    if (stepIndex >= steps.length - 1) {
      closeTour();
      return;
    }
    setStepIndex(index => index + 1);
  }

  if (steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={openTour}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-aviation-200 bg-aviation-600 text-white shadow-2xl shadow-aviation-900/30 transition-all hover:scale-105 hover:bg-aviation-500 focus:outline-none focus:ring-4 focus:ring-aviation-300/40 dark:border-aviation-400/30"
        title={title}
      >
        <HelpCircle className="h-7 w-7" />
      </button>
      <AnimatedPageTour
        open={open}
        steps={steps}
        stepIndex={stepIndex}
        targetAttribute={targetAttribute}
        detailLabel={detailLabel}
        onBack={back}
        onNext={next}
        onClose={closeTour}
      />
    </>
  );
}
