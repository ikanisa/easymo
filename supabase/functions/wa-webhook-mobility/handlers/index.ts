/**
 * Mobility Handlers Registry
 * Simplified - no longer using lazy-loaded handlers
 * All logic is now in index.ts
 */

// Handlers are now directly in index.ts for simplicity
// This file is kept for compatibility but is no longer used

export function preloadCriticalHandlers(): void {
  // No-op: handlers are now in index.ts
}

export async function getHandler(action: string) {
  // No-op: handlers are now in index.ts
  return null;
}
