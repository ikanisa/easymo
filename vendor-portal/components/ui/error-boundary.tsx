"use client";

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  FallbackComponent?: React.ComponentType<FallbackProps>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface FallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // TODO: Send to error tracking service (Sentry, etc.)
    // Example:
    // Sentry.captureException(error, { extra: errorInfo });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if reset keys change
    if (
      hasError &&
      resetKeys &&
      prevProps.resetKeys &&
      !this.arraysEqual(resetKeys, prevProps.resetKeys)
    ) {
      this.resetError();
    }
  }

  arraysEqual(a: Array<string | number>, b: Array<string | number>): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, FallbackComponent } = this.props;

    if (hasError && error) {
      // Use custom fallback component if provided
      if (FallbackComponent) {
        return <FallbackComponent error={error} errorInfo={errorInfo} resetError={this.resetError} />;
      }

      // Use custom fallback JSX if provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
        />
      );
    }

    return children;
  }
}

function DefaultErrorFallback({ error, errorInfo, resetError }: FallbackProps): JSX.Element {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <div className="p-6">
          {/* Error Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-error-light/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-error-light" />
            </div>
          </div>

          {/* Error Title */}
          <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
            Something went wrong
          </h2>

          {/* Error Message */}
          <p className="text-text-secondary text-center mb-6">
            We encountered an unexpected error. Please try again.
          </p>

          {/* Error Details (Development only) */}
          {isDevelopment && (
            <div className="mb-6 space-y-4">
              <details className="bg-surface-overlay rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-sm text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning-light" />
                  Error Details
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary mb-1">Error Message:</p>
                    <pre className="text-xs text-error-light bg-surface-elevated p-2 rounded overflow-x-auto">
                      {error.message}
                    </pre>
                  </div>
                  {error.stack && (
                    <div>
                      <p className="text-xs font-semibold text-text-secondary mb-1">Stack Trace:</p>
                      <pre className="text-xs text-text-muted bg-surface-elevated p-2 rounded overflow-x-auto max-h-48">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs font-semibold text-text-secondary mb-1">Component Stack:</p>
                      <pre className="text-xs text-text-muted bg-surface-elevated p-2 rounded overflow-x-auto max-h-48">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={resetError}
              variant="primary"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Reload Page
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-text-muted text-center mt-6">
            If this problem persists, please contact support.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Specialized Error Boundary for AI features
interface AIErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  resetKeys?: Array<string | number>;
}

export function AIErrorBoundary({ children, onError, resetKeys }: AIErrorBoundaryProps): JSX.Element {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('AI Component Error:', error);
    onError?.(error);
    
    // TODO: Log to analytics
    // analytics.track('ai_error', {
    //   error: error.message,
    //   component: errorInfo.componentStack,
    // });
  };

  return (
    <ErrorBoundary
      onError={handleError}
      resetKeys={resetKeys}
      FallbackComponent={AIErrorFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

function AIErrorFallback({ error, resetError }: FallbackProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-error-light/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-error-light" />
      </div>
      
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        AI Assistant Error
      </h3>
      
      <p className="text-sm text-text-secondary mb-4 max-w-md">
        The AI assistant encountered an error. This could be due to network issues or an invalid response.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4 text-left w-full max-w-md">
          <summary className="text-xs text-text-muted cursor-pointer mb-2">
            Error Details
          </summary>
          <pre className="text-xs text-error-light bg-surface-overlay p-2 rounded overflow-x-auto">
            {error.message}
          </pre>
        </details>
      )}

      <div className="flex gap-2">
        <Button onClick={resetError} variant="primary" size="sm">
          Try Again
        </Button>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          size="sm"
        >
          Reload
        </Button>
      </div>
    </div>
  );
}
