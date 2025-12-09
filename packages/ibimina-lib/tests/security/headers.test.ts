import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SECURITY_HEADERS,
  createContentSecurityPolicy,
  createNonce,
  createRequestId,
  createSecureHeaders,
} from "../../src/security";

declare global {
  // Extend the global scope for typed crypto overrides in tests.

  var crypto: Crypto | undefined;
}

const originalWarn = console.warn;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  console.warn = originalWarn;
});

describe("createNonce", () => {
  it("uses getRandomValues when available", () => {
    const bytes = [0xde, 0xad, 0xbe, 0xef, 0x42, 0x13, 0x37, 0xff];
    vi.stubGlobal("crypto", {
      getRandomValues(array: Uint8Array) {
        array.set(bytes);
        return array;
      },
    });

    const nonce = createNonce(8);

    expect(nonce).toBe(Buffer.from(Uint8Array.from(bytes)).toString("base64"));
  });

  it("falls back to randomUUID when getRandomValues is unavailable", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    const nonce = createNonce();

    expect(nonce).toBe("123e4567e89b12d3a456426614174000");
  });

  it("throws when no secure random generator is available", () => {
    vi.stubGlobal("crypto", {});

    expect(() => createNonce()).toThrow(/Secure random number generation is unavailable/);
  });
});

describe("createRequestId", () => {
  it("prefers randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValue("550e8400-e29b-41d4-a716-446655440000"),
    });

    expect(createRequestId()).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("generates a hexadecimal identifier when using getRandomValues", () => {
    const buffer = Array.from({ length: 16 }, (_, index) => index + 1);
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        array.set(buffer);
        return array;
      },
    });

    expect(createRequestId()).toBe(
      buffer.map((byte) => byte.toString(16).padStart(2, "0")).join("")
    );
  });
});

describe("createContentSecurityPolicy", () => {
  it("includes strict nonce-based script directives and Supabase origins", () => {
    const policy = createContentSecurityPolicy({
      nonce: "abc123",
      supabaseUrl: "https://project.supabase.co",
    });

    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy).toContain(
      "connect-src 'self' https://project.supabase.co wss://project.supabase.co"
    );
    expect(policy).toContain(
      "img-src 'self' data: blob: https://images.unsplash.com https://api.qrserver.com https://project.supabase.co/storage/v1/object/public https://avatars.githubusercontent.com"
    );
    expect(policy).toContain(
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://rsms.me/inter/inter.css"
    );
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("logs a warning when the Supabase URL is invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const policy = createContentSecurityPolicy({ nonce: "test", supabaseUrl: "not-a-url" });

    expect(policy).toContain("script-src 'self' 'nonce-test' 'strict-dynamic'");
    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid Supabase URL provided for CSP",
      expect.any(Error)
    );
  });

  it("enables development websocket connections when isDev is set", () => {
    const policy = createContentSecurityPolicy({ nonce: "dev", isDev: true });

    expect(policy).toContain("connect-src 'self' ws://localhost:3100 ws://127.0.0.1:3100");
    expect(policy).toContain("script-src 'self' 'nonce-dev' 'strict-dynamic' 'unsafe-eval'");
  });
});

describe("createSecureHeaders", () => {
  it("returns a defensive copy of the shared security headers", () => {
    const headers = createSecureHeaders();

    expect(headers).toEqual(SECURITY_HEADERS);
    expect(headers).not.toBe(SECURITY_HEADERS);
    headers.push({ key: "x-test", value: "noop" });
    expect(SECURITY_HEADERS).not.toContainEqual({ key: "x-test", value: "noop" });
  });
});
