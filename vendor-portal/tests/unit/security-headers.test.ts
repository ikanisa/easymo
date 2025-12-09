import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createNonce, createRequestId } from "@/lib/security/headers";

type CryptoDescriptor = PropertyDescriptor | undefined;

function setGlobalCrypto(value: unknown) {
  Object.defineProperty(globalThis, "crypto", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

describe("security header helpers", () => {
  let originalDescriptor: CryptoDescriptor;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis as Record<string, unknown>, "crypto");
    }
    originalDescriptor = undefined;
  });

  it("produces a base64 nonce using getRandomValues", () => {
    const calls: number[] = [];
    setGlobalCrypto({
      getRandomValues(buffer: Uint8Array) {
        calls.push(buffer.length);
        buffer.forEach((_, index) => {
          buffer[index] = index + 1;
        });
        return buffer;
      },
    });

    const nonce = createNonce(4);
    assert.equal(calls.length, 1);
    assert.match(nonce, /^[A-Za-z0-9+/=]+$/);
  });

  it("falls back to randomUUID when getRandomValues is unavailable", () => {
    const uuid = "12345678-1234-5678-1234-567812345678";
    setGlobalCrypto({
      randomUUID: () => uuid,
    });

    const nonce = createNonce();
    assert.equal(nonce, uuid.replace(/-/g, ""));
  });

  it("falls back to runtime crypto when Web Crypto APIs are missing", () => {
    setGlobalCrypto(undefined);

    const nonce = createNonce();
    assert.equal(typeof nonce, "string");
    assert.ok(nonce.length > 0);
  });

  it("generates request IDs via randomUUID when available", () => {
    const uuid = "a2cb8a76-4b0a-4139-8f8a-47c2f5e18720";
    setGlobalCrypto({
      randomUUID: () => uuid,
    });

    const requestId = createRequestId();
    assert.equal(requestId, uuid);
  });

  it("derives hex request IDs from getRandomValues when randomUUID is absent", () => {
    setGlobalCrypto({
      getRandomValues(buffer: Uint8Array) {
        buffer.fill(0xab);
        return buffer;
      },
    });

    const requestId = createRequestId();
    assert.match(requestId, /^[a-f0-9]{32}$/);
  });

  it("falls back to runtime crypto for request IDs without Web Crypto", () => {
    setGlobalCrypto(undefined);

    const requestId = createRequestId();
    assert.equal(typeof requestId, "string");
    assert.ok(requestId.length > 0);
  });
});
