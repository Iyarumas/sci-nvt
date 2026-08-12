import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

const VARIANT_STYLES: Record<AlertVariant, { icon: LucideIcon; iconWrap: string; iconText: string; confirm: string }> = {
  info: {
    icon: Info,
    iconWrap: 'bg-aviation-100 dark:bg-aviation-900/30',
    iconText: 'text-aviation-600 dark:text-aviation-400',
    confirm: 'from-aviation-600 to-aviation-700 shadow-aviation-500/20 hover:from-aviation-500 hover:to-aviation-600',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    confirm: 'from-amber-500 to-amber-600 shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500',
  },
  danger: {
    icon: Trash2,
    iconWrap: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
    confirm: 'from-alert-red to-red-700 shadow-red-500/20 hover:from-red-600 hover:to-red-700',
  },
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-green-100 dark:bg-green-900/30',
    iconText: 'text-green-600 dark:text-green-400',
    confirm: 'from-green-600 to-green-700 shadow-green-500/20 hover:from-green-500 hover:to-green-600',
  },
};

export interface AlertModalProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  variant?: AlertVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: ReactNode;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
}

export function AlertModal({
  open,
  title,
  message,
  children,
  variant = 'warning',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loadingLabel = 'Processando...',
  loading = false,
  confirmDisabled = false,
  error,
  onClose,
  onConfirm,
}: AlertModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;
  const busy = loading || internalLoading;

  async function handleConfirm() {
    if (!onConfirm || busy || confirmDisabled) return;
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-xl shadow-black/10 dark:bg-surface-card dark:shadow-black/30">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}>
            <Icon className={`h-5 w-5 ${styles.iconText}`} />
          </div>
          <h3 className="min-w-0 text-lg font-bold text-graphite-900 dark:text-graphite-100">
            {title}
          </h3>
        </div>

        {message && (
          <div className="mb-4 text-sm leading-6 text-graphite-500 dark:text-graphite-400">
            {message}
          </div>
        )}
        {children}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-alert-red dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{error}</div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover/50"
          >
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || confirmDisabled}
              className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${styles.confirm}`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? loadingLabel : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
