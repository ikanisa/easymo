'use client';

import { motion } from 'framer-motion';
import { useEffect,useState } from 'react';

import { cn } from '@/lib/utils';

import { GlassHeader } from './GlassHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { RailNav } from './RailNav';

interface FluidShellProps {
  children: React.ReactNode;
}

export function FluidShell({ children }: FluidShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    if (!sidebarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('aside') && !target.closest('button[aria-label="Toggle menu"]')) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-aurora-bg">
      {/* Ambient Background */}
      <AmbientBackground />

      {/* Glass Header */}
      <GlassHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Layout */}
      <div className="flex pt-14">
        {/* Desktop Collapsible Rail Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarExpanded ? 240 : 64 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          className={cn(
            'fixed left-0 top-14 bottom-0 z-40',
            'hidden lg:flex flex-col',
            'glass-surface border-r border-aurora-border'
          )}
        >
          <RailNav expanded={sidebarExpanded} />
        </motion.aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-14 bottom-0 w-64 z-40 lg:hidden glass-surface border-r border-aurora-border"
            >
              <RailNav expanded={true} />
            </motion.aside>
          </>
        )}

        {/* Content Area */}
        <main
          className={cn(
            'flex-1 min-h-[calc(100vh-56px)] transition-all duration-300',
            'lg:ml-16', // Rail width when collapsed
            sidebarExpanded && 'lg:ml-60', // Expanded width
            'pb-20 lg:pb-0' // Space for mobile bottom nav
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav className="lg:hidden" />
    </div>
  );
}

function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Gradient Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl" />
    </div>
  );
}
