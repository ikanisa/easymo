/**
 * Aurora Tabs Component
 * Tab navigation with smooth indicator
 */

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (id: string) => void;
} | null>(null);

interface TabsProps {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ defaultValue, className, children }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={cn('flex gap-1 border-b border-[var(--aurora-border)]', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: { value: string, children: React.ReactNode, className?: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');
  
  const isActive = context.activeTab === value;

  return (
    <button
      onClick={() => context.setActiveTab(value)}
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg',
        isActive
          ? 'text-[var(--aurora-accent)]'
          : 'text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text-primary)]',
        className
      )}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--aurora-accent)]"
        />
      )}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string, children: React.ReactNode, className?: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div className={cn('pt-6', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
