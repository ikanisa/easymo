/**
 * Page-level Error Boundary Wrapper
 * Wraps individual pages with error boundaries for better error isolation
 */

'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

import { ErrorBoundary } from './error-boundary';

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
}

export function PageErrorBoundary({ children, pageName }: PageErrorBoundaryProps) {
  const fallback = (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {pageName ? `Error loading ${pageName}` : 'Page Error'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Something went wrong while loading this page. Please try refreshing.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );

  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
}
