import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "./utils/react-testing";
// import { clearCachedCredentials } from "@/lib/auth/credentials"; // REMOVED: Auth disabled
import { webcrypto } from "node:crypto";

const cookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => {
  const headers = () => ({
    get: (key: string) =>
      key.toLowerCase() === "x-actor-id"
        ? process.env.ADMIN_TEST_ACTOR_ID || "00000000-0000-0000-0000-000000000001"
        : null,
  });

  const cookies = () => ({
    get: (name: string) => {
      const entry = cookieStore.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    getAll: () => Array.from(cookieStore.entries()).map(([name, entry]) => ({ name, value: entry.value })),
    set: (name: string, value: string | { value: string }) => {
      const actual = typeof value === "string" ? value : value.value;
      cookieStore.set(name, { value: actual });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  });

  return { headers, cookies };
});

vi.mock("@va/shared", async () => {
  const actual = await vi.importActual<typeof import("@va/shared")>("@va/shared");
  return {
    ...actual,
    adminRouteDefinitions: {},
    adminRoutePaths: {},
    adminRouteSegments: {},
    getAdminRoutePath: (...segments: string[]) => `/${segments.join("/")}`,
    isAdminRoutePath: () => true,
  };
});

afterEach(() => {
  cleanup();
  cookieStore.clear();
});

beforeEach(() => {
  // clearCachedCredentials(); // REMOVED: Auth disabled
});

// Ensure Web Crypto APIs are available for session token signing in tests.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  // @ts-expect-error Node.js webcrypto shim for test environment
  globalThis.crypto = webcrypto;
}

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

  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;

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
const SUPPRESSED = /ReactDOMTestUtils\.act is deprecated|not wrapped in act\(|When testing, code that causes React state updates should be wrapped into act\(|current testing environment is not configured to support act\(/i;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && SUPPRESSED.test(args[0])) return;
  originalError(...args);
};
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && SUPPRESSED.test(args[0])) return;
  originalWarn(...args);
};

process.env.ADMIN_ACCESS_CREDENTIALS =
  process.env.ADMIN_ACCESS_CREDENTIALS ||
  JSON.stringify([
    {
      actorId: "00000000-0000-0000-0000-000000000001",
      email: "info@ikanisa.com",
      password: "MoMo!!0099",
      username: "Admin",
      label: "Test Operator",
    },
  ]);

process.env.ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || "test-session-secret-123456789";

process.env.ADMIN_ALLOW_ANY_ACTOR =
  process.env.ADMIN_ALLOW_ANY_ACTOR || "true";

process.env.ADMIN_TEST_ACTOR_ID =
  process.env.ADMIN_TEST_ACTOR_ID || "00000000-0000-0000-0000-000000000001";
