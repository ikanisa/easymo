/**
 * Aurora Modal Component
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { modalBackdrop, modalContent } from '@/lib/motion/presets';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
          />
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                'relative w-full rounded-2xl bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
                'shadow-xl max-h-[90vh] overflow-hidden flex flex-col',
                sizeClasses[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {(title || description) && (
                <div className="px-6 py-4 border-b border-[var(--aurora-border)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {title && <h2 className="text-xl font-semibold text-[var(--aurora-text-primary)]">{title}</h2>}
                      {description && <p className="mt-1 text-sm text-[var(--aurora-text-secondary)]">{description}</p>}
                    </div>
                    <button onClick={onClose} className="ml-4 p-2 rounded-lg text-[var(--aurora-text-muted)] hover:bg-[var(--aurora-surface-elevated)] transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--aurora-border)]', className)}>{children}</div>;
}
