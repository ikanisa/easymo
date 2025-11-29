/**
 * Aurora Toast Component
 * Notification system with queue
 */

'use client';

import { AnimatePresence,motion } from 'framer-motion';
import { AlertCircle, AlertTriangle,CheckCircle, Info, X } from 'lucide-react';
import { createContext, useCallback,useContext, useState } from 'react';

import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-[var(--aurora-success)] text-white',
  error: 'bg-[var(--aurora-error)] text-white',
  info: 'bg-[var(--aurora-info)] text-white',
  warning: 'bg-[var(--aurora-warning)] text-white',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const Icon = icons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'rounded-xl p-4 shadow-lg backdrop-blur-sm',
        'flex items-start gap-3 min-w-[320px]',
        colors[toast.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.description && (
          <p className="text-xs opacity-90 mt-1">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
