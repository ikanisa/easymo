/**
 * Error Boundary Usage Examples
 * 
 * This file demonstrates how to use the ErrorBoundary component
 */

import { ErrorBoundary, AIErrorBoundary } from '@/components/ui/error-boundary';
import { SafeAIAssistantPanel } from '@/components/ai';

// Example 1: Basic usage with default fallback
export function Example1() {
  return (
    <ErrorBoundary>
      <ComponentThatMightThrow />
    </ErrorBoundary>
  );
}

// Example 2: Custom error handler
export function Example2() {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Caught error:', error);
    // Send to analytics
    // analytics.track('component_error', { error: error.message });
  };

  return (
    <ErrorBoundary onError={handleError}>
      <ComponentThatMightThrow />
    </ErrorBoundary>
  );
}

// Example 3: Custom fallback UI
export function Example3() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-center">
          <p>Oops! Something went wrong.</p>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      }
    >
      <ComponentThatMightThrow />
    </ErrorBoundary>
  );
}

// Example 4: Reset on prop changes
export function Example4({ userId }: { userId: string }) {
  return (
    <ErrorBoundary resetKeys={[userId]}>
      <UserProfile userId={userId} />
    </ErrorBoundary>
  );
}

// Example 5: AI Error Boundary (specialized)
export function Example5() {
  return (
    <AIErrorBoundary onError={(error) => console.error(error)}>
      <SafeAIAssistantPanel onClose={() => {}} />
    </AIErrorBoundary>
  );
}

// Example 6: Custom fallback component
function CustomFallback({ error, resetError }: any) {
  return (
    <div className="error-container">
      <h2>Error occurred!</h2>
      <p>{error.message}</p>
      <button onClick={resetError}>Try Again</button>
    </div>
  );
}

export function Example6() {
  return (
    <ErrorBoundary FallbackComponent={CustomFallback}>
      <ComponentThatMightThrow />
    </ErrorBoundary>
  );
}

// Example 7: Nested error boundaries
export function Example7() {
  return (
    <ErrorBoundary>
      <div>
        <Header />
        <ErrorBoundary>
          <Sidebar />
        </ErrorBoundary>
        <ErrorBoundary>
          <MainContent />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

// Dummy components for examples
function ComponentThatMightThrow() { return <div>Component</div>; }
function UserProfile({ userId }: { userId: string }) { return <div>{userId}</div>; }
function Header() { return <header>Header</header>; }
function Sidebar() { return <aside>Sidebar</aside>; }
function MainContent() { return <main>Content</main>; }
