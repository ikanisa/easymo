'use client';

/**
 * Bulk Actions Component
 * Actions for bulk processing of payments
 */

import { Button } from '../ui/Button';

export interface BulkActionsProps {
  selectedCount: number;
  onAutoMatch: () => void | Promise<void>;
  onMarkReviewed: () => void | Promise<void>;
  onExport: () => void;
  loading?: boolean;
}

export function BulkActions({
  selectedCount,
  onAutoMatch,
  onMarkReviewed,
  onExport,
  loading = false,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium text-blue-900">
          {selectedCount} payment{selectedCount > 1 ? 's' : ''} selected
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={onAutoMatch}
            loading={loading}
          >
            Auto-Match
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onMarkReviewed}
            loading={loading}
          >
            Mark Reviewed
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
          >
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}
