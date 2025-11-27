'use client';

import * as React from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Sheet({ isOpen, onClose, children, title, className }: SheetProps) {
  const dragControls = useDragControls();

  const handleDragEnd = React.useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.velocity.y > 500 || info.offset.y > 200) {
        onClose();
      }
    },
    [onClose]
  );

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50',
              'max-h-[90vh] rounded-t-3xl',
              'bg-card border-t border-border',
              'flex flex-col',
              'touch-none',
              className
            )}
          >
            {/* Drag Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex-shrink-0 py-4 cursor-grab active:cursor-grabbing"
            >
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-4 pb-4 border-b border-border">
                <h2 className="text-xl font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-accent transition-colors touch-manipulation"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
