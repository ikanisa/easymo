/**
 * Desktop-Specific Security Monitoring
 * Tracks security-relevant events in the desktop app
 */

import { logStructuredEvent } from '@/lib/monitoring/logger';
import { metrics } from '@/lib/monitoring/metrics';

export interface SecurityEvent {
  type: 'auth_failure' | 'update_check' | 'deep_link' | 'file_access' | 'shortcut_trigger' | 'tray_access';
  action: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

class DesktopSecurityMonitor {
  private eventBuffer: SecurityEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  /**
   * Track authentication attempts
   */
  trackAuth(success: boolean, method: string, error?: string): void {
    const event: SecurityEvent = {
      type: 'auth_failure',
      action: 'login_attempt',
      success,
      metadata: { method, error },
    };

    this.recordEvent(event);
    metrics.increment('desktop.auth.attempts', { success: String(success), method });

    if (!success) {
      logStructuredEvent('DESKTOP_AUTH_FAILURE', {
        method,
        error,
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }
  }

  /**
   * Track auto-update checks and installs
   */
  trackUpdate(action: 'check' | 'download' | 'install', success: boolean, version?: string, error?: string): void {
    const event: SecurityEvent = {
      type: 'update_check',
      action,
      success,
      metadata: { version, error },
    };

    this.recordEvent(event);
    metrics.increment('desktop.update.actions', { action, success: String(success) });

    logStructuredEvent('DESKTOP_UPDATE', {
      action,
      success,
      version,
      error,
      timestamp: new Date().toISOString(),
    }).catch(console.error);
  }

  /**
   * Track deep link access
   */
  trackDeepLink(url: string, success: boolean, error?: string): void {
    const event: SecurityEvent = {
      type: 'deep_link',
      action: 'handle_link',
      success,
      metadata: { url: this.sanitizeUrl(url), error },
    };

    this.recordEvent(event);
    metrics.increment('desktop.deeplink.handled', { success: String(success) });

    logStructuredEvent('DESKTOP_DEEP_LINK', {
      urlPattern: this.sanitizeUrl(url),
      success,
      error,
      timestamp: new Date().toISOString(),
    }).catch(console.error);
  }

  /**
   * Track file system access
   */
  trackFileAccess(operation: 'read' | 'write' | 'dialog', path: string, success: boolean, error?: string): void {
    const event: SecurityEvent = {
      type: 'file_access',
      action: operation,
      success,
      metadata: { path: this.sanitizePath(path), error },
    };

    this.recordEvent(event);
    metrics.increment('desktop.file.operations', { operation, success: String(success) });

    if (!success) {
      logStructuredEvent('DESKTOP_FILE_ACCESS_FAILED', {
        operation,
        path: this.sanitizePath(path),
        error,
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }
  }

  /**
   * Track global shortcut usage
   */
  trackShortcut(shortcut: string, action: string): void {
    const event: SecurityEvent = {
      type: 'shortcut_trigger',
      action,
      success: true,
      metadata: { shortcut },
    };

    this.recordEvent(event);
    metrics.increment('desktop.shortcut.triggered', { shortcut, action });
  }

  /**
   * Track system tray interactions
   */
  trackTrayAction(action: 'show' | 'hide' | 'quit'): void {
    const event: SecurityEvent = {
      type: 'tray_access',
      action,
      success: true,
    };

    this.recordEvent(event);
    metrics.increment('desktop.tray.actions', { action });
  }

  /**
   * Get security events for analysis
   */
  getEvents(type?: SecurityEvent['type'], since?: number): SecurityEvent[] {
    let events = this.eventBuffer;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    if (since) {
      events = events.filter(e => (e.metadata?.timestamp as number || 0) >= since);
    }

    return events;
  }

  /**
   * Get failed authentication attempts count
   */
  getFailedAuthCount(since?: number): number {
    return this.getEvents('auth_failure', since).filter(e => !e.success).length;
  }

  /**
   * Clear event buffer
   */
  clear(): void {
    this.eventBuffer = [];
  }

  private recordEvent(event: SecurityEvent): void {
    if (this.eventBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.eventBuffer.shift();
    }

    this.eventBuffer.push({
      ...event,
      metadata: {
        ...event.metadata,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Sanitize URL for logging (remove sensitive params)
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove sensitive query params
      parsed.searchParams.delete('token');
      parsed.searchParams.delete('key');
      parsed.searchParams.delete('secret');
      parsed.searchParams.delete('password');
      return parsed.toString();
    } catch {
      return '[invalid-url]';
    }
  }

  /**
   * Sanitize file path (remove user directory)
   */
  private sanitizePath(path: string): string {
    if (typeof window !== 'undefined') {
      // Remove user home directory from path
      const userHome = process.env.HOME || process.env.USERPROFILE || '';
      if (userHome && path.startsWith(userHome)) {
        return path.replace(userHome, '~');
      }
    }
    return path;
  }
}

export const desktopSecurityMonitor = new DesktopSecurityMonitor();

/**
 * Rate limiter for sensitive operations
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  /**
   * Check if action is allowed (not rate limited)
   */
  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return true;
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Get remaining attempts
   */
  getRemaining(key: string, maxAttempts: number, windowMs: number): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    return Math.max(0, maxAttempts - recentAttempts.length);
  }
}

export const rateLimiter = new RateLimiter();
