/**
 * Empty State Component
 * Provides consistent empty state UI across the admin panel
 */

import { ReactNode } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      
      <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-6">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            {action.label}
          </button>
        </div>
      )}
      
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
