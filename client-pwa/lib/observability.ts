/**
 * Client-side observability utilities
 * Lightweight logging for PWA
 */

export interface LogEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Log structured event (client-side)
 */
export async function logStructuredEvent(
  event: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const logData: LogEvent = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  // Console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Event]', event, data);
  }

  // Send to analytics endpoint (non-blocking)
  try {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
      keepalive: true, // Continue even if page unloads
    }).catch(() => {
      // Silently fail - don't block user experience
    });
  } catch {
    // Silently fail
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string): void {
  logStructuredEvent('PAGE_VIEW', { path });
}

/**
 * Track user action
 */
export function trackAction(action: string, data?: Record<string, unknown>): void {
  logStructuredEvent('USER_ACTION', { action, ...data });
}
