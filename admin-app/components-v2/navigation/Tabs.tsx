/**
 * Aurora Tabs Component
 * Tab navigation with smooth indicator
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, defaultTab, onChange, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [indicatorProps, setIndicatorProps] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeButton = tabRefs.current[activeTab];
    if (activeButton) {
      setIndicatorProps({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [activeTab]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className={cn('w-full', className)}>
      <div className="relative border-b border-[var(--aurora-border)]">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors',
                'flex items-center gap-2 rounded-t-lg',
                activeTab === tab.id
                  ? 'text-[var(--aurora-accent)]'
                  : 'text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text-primary)]',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <motion.div
          className="absolute bottom-0 h-0.5 bg-[var(--aurora-accent)]"
          animate={{ left: indicatorProps.left, width: indicatorProps.width }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
      <div className="pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTabData?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
