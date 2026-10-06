import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  showToast: (opts: { title: string; description?: string; message?: string; variant?: string }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus digunakan di dalam <ToastProvider>');
  return ctx;
}

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-[#D4AF37]" />,
  error: <AlertTriangle className="w-4 h-4 text-rose-600" />,
  info: <Info className="w-4 h-4 text-[#415A77]" />,
};

const TOAST_ACCENT: Record<ToastType, string> = {
  success: 'border-l-[#D4AF37]',
  error: 'border-l-rose-600',
  info: 'border-l-[#415A77]',
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${++counterRef.current}`;
    const duration = opts.duration ?? 4000;
    const newToast: Toast = { ...opts, id };
    
    setToasts(prev => [...prev.slice(-4), newToast]); // max 5 toasts
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const showToast = useCallback((opts: { title: string; description?: string; message?: string; variant?: string }) => {
    const type: ToastType = (opts.variant === 'error' ? 'error' : opts.variant === 'info' ? 'info' : 'success');
    addToast({ type, title: opts.title, message: opts.description || opts.message });
  }, [addToast]);

  const contextValue: ToastContextValue = {
    toast: addToast,
    showToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Container: Fixed top-right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto bg-white border border-slate-200/80 border-l-[3px] ${TOAST_ACCENT[t.type]} rounded-lg shadow-md p-4 flex items-start gap-3 animate-slide-in-right`}
          >
            <div className="mt-0.5 flex-shrink-0">{TOAST_ICONS[t.type]}</div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-xs font-bold text-[#0D1B2A]">{t.title}</p>
              {t.message && (
                <p className="text-[11px] text-slate-600 leading-relaxed truncate">{t.message}</p>
              )}
            </div>
            <button 
              onClick={() => removeToast(t.id)} 
              className="text-slate-400 hover:text-[#0D1B2A] transition-colors flex-shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
