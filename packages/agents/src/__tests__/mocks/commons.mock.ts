/**
 * Mock for @easymo/commons package
 * Used in tests to avoid needing the actual package
 */

export function childLogger(options: { service: string }) {
  return {
    info: (...args: unknown[]) => {
      // Silent in tests
    },
    error: (...args: unknown[]) => {
      // Silent in tests
    },
    warn: (...args: unknown[]) => {
      // Silent in tests
    },
    debug: (...args: unknown[]) => {
      // Silent in tests
    },
  };
}
