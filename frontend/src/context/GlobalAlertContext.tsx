import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertModal } from '../components/ui/AlertModal';

export type GlobalAlertVariant = 'info' | 'warning' | 'danger' | 'success';

export interface GlobalAlertOptions {
  title?: string;
  message: ReactNode;
  variant?: GlobalAlertVariant;
  confirmLabel?: string;
}

interface GlobalAlertContextValue {
  showAlert: (options: string | GlobalAlertOptions) => void;
  closeAlert: () => void;
}

declare global {
  interface Window {
    showAppAlert?: (options: string | GlobalAlertOptions) => void;
  }
}

const GlobalAlertContext = createContext<GlobalAlertContextValue | null>(null);

function variantFromMessage(message: string): GlobalAlertVariant {
  const normalized = message.toLowerCase();
  if (normalized.includes('erro') || normalized.includes('falha')) return 'danger';
  if (normalized.includes('atenção') || normalized.includes('atencao') || normalized.includes('aviso')) return 'warning';
  if (normalized.includes('sucesso') || normalized.includes('salvo') || normalized.includes('criado')) return 'success';
  return 'info';
}

export function GlobalAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<GlobalAlertOptions | null>(null);

  const showAlert = useCallback((options: string | GlobalAlertOptions) => {
    if (typeof options === 'string') {
      setAlert({
        title: variantFromMessage(options) === 'danger' ? 'Erro' : 'Aviso',
        message: options,
        variant: variantFromMessage(options),
      });
      return;
    }

    setAlert({
      title: options.title || 'Aviso',
      message: options.message,
      variant: options.variant || 'info',
      confirmLabel: options.confirmLabel,
    });
  }, []);

  const closeAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    const nativeAlert = window.alert;
    window.showAppAlert = showAlert;
    window.alert = (message?: unknown) => showAlert(String(message ?? ''));

    return () => {
      window.alert = nativeAlert;
      if (window.showAppAlert === showAlert) delete window.showAppAlert;
    };
  }, [showAlert]);

  const value = useMemo(() => ({ showAlert, closeAlert }), [showAlert, closeAlert]);

  return (
    <GlobalAlertContext.Provider value={value}>
      {children}
      <AlertModal
        open={!!alert}
        title={alert?.title || 'Aviso'}
        message={alert?.message}
        variant={alert?.variant || 'info'}
        cancelLabel={alert?.confirmLabel || 'Entendi'}
        onClose={closeAlert}
      />
    </GlobalAlertContext.Provider>
  );
}

export function useGlobalAlert() {
  const context = useContext(GlobalAlertContext);
  if (!context) throw new Error('useGlobalAlert must be used within GlobalAlertProvider');
  return context;
}
