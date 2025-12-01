'use client';

/**
 * PortalShell - Main PWA layout wrapper for Vendor Portal
 * Mobile-first design with bottom navigation
 */

import type { ReactNode } from 'react';

import { BottomNav } from './BottomNav';
import { PortalHeader } from './PortalHeader';

interface PortalShellProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  headerActions?: ReactNode;
}

export function PortalShell({
  children,
  title = 'Vendor Portal',
  showBackButton = false,
  onBack,
  headerActions,
}: PortalShellProps) {
  return (
    <div className="vp-shell">
      <header className="vp-shell__header">
        <PortalHeader
          title={title}
          showBackButton={showBackButton}
          onBack={onBack}
          actions={headerActions}
        />
      </header>
      <main className="vp-shell__content">
        {children}
      </main>
      <nav className="vp-shell__nav" aria-label="Main navigation">
        <BottomNav />
      </nav>
    </div>
  );
}
