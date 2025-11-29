/**
 * Aurora DropdownMenu Component
 * Context menus and dropdown actions
 */

'use client';

import { AnimatePresence,motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect,useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  submenu?: DropdownMenuItem[];
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ items, trigger, align = 'left', className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              'absolute z-50 mt-2 min-w-[200px] rounded-xl',
              'bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
              'shadow-lg overflow-hidden',
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            <div className="py-1">
              {items.map((item) => (
                <DropdownMenuItemComponent
                  key={item.id}
                  item={item}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownMenuItemComponent({ 
  item, 
  onClose 
}: { 
  item: DropdownMenuItem; 
  onClose: () => void;
}) {
  const [showSubmenu, setShowSubmenu] = useState(false);

  if (item.divider) {
    return <div className="my-1 h-px bg-[var(--aurora-border)]" />;
  }

  const handleClick = () => {
    if (item.disabled) return;
    if (!item.submenu) {
      item.onClick?.();
      onClose();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => item.submenu && setShowSubmenu(true)}
      onMouseLeave={() => item.submenu && setShowSubmenu(false)}
    >
      <button
        onClick={handleClick}
        disabled={item.disabled}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm',
          'transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          item.danger
            ? 'text-[var(--aurora-error)] hover:bg-[var(--aurora-error)]/10'
            : 'text-[var(--aurora-text-primary)] hover:bg-[var(--aurora-surface-muted)]'
        )}
      >
        {item.icon && <span className="w-4 h-4">{item.icon}</span>}
        <span className="flex-1 text-left">{item.label}</span>
        {item.submenu && <ChevronRight className="w-4 h-4" />}
      </button>

      {item.submenu && showSubmenu && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'absolute left-full top-0 ml-1 min-w-[180px]',
            'rounded-xl bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
            'shadow-lg overflow-hidden'
          )}
        >
          <div className="py-1">
            {item.submenu.map((subitem) => (
              <DropdownMenuItemComponent
                key={subitem.id}
                item={subitem}
                onClose={onClose}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
