import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "./utils/react-testing";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  window.matchMedia = window.matchMedia ||
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // @ts-expect-error jsdom mock
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;

  // @ts-expect-error jsdom mock
  window.IntersectionObserver = window.IntersectionObserver || class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Suppress noisy act() deprecation warnings in tests for components that
// indirectly use legacy helpers in third-party libs.
const originalError = console.error;
const originalWarn = console.warn;
const SUPPRESSED = /ReactDOMTestUtils\.act is deprecated/i;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && SUPPRESSED.test(args[0])) return;
  // @ts-ignore
  originalError(...args);
};
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && SUPPRESSED.test(args[0])) return;
  // @ts-ignore
  originalWarn(...args);
};

// Provide a default actor for server routes in tests so write endpoints
// guarded by requireActorId() resolve with a valid UUID.
process.env.ADMIN_DEFAULT_ACTOR_ID = process.env.ADMIN_DEFAULT_ACTOR_ID || '00000000-0000-0000-0000-000000000001';
