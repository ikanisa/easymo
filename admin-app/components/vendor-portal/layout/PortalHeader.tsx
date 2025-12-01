'use client';

/**
 * PortalHeader - Top header component for Vendor Portal
 * Includes back button, title, and action buttons
 */

import { ArrowLeft, Bell } from 'lucide-react';
import type { ReactNode } from 'react';

interface PortalHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}

export function PortalHeader({
  title,
  showBackButton = false,
  onBack,
  actions,
}: PortalHeaderProps) {
  return (
    <div className="vp-header">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <button
            type="button"
            className="vp-header__back"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="vp-header__title">{title}</h1>
      </div>
      <div className="vp-header__actions">
        {actions || (
          <button
            type="button"
            className="vp-header__back"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
