import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { logError, logInfo, updateLogContext, withLogContext } from "@/lib/observability/logger";

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("observability logger", () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    console.log = (...args: unknown[]) => {
      originalLog(...args);
    };
    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
    };
    console.error = (...args: unknown[]) => {
      originalError(...args);
    };
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    delete process.env.LOG_DRAIN_URL;
    delete process.env.LOG_DRAIN_TOKEN;
    delete process.env.LOG_DRAIN_SOURCE;
    delete process.env.LOG_DRAIN_TIMEOUT_MS;
    delete process.env.LOG_DRAIN_SILENT;
    delete process.env.LOG_DRAIN_ALERT_WEBHOOK;
    delete process.env.LOG_DRAIN_ALERT_TOKEN;
    delete process.env.LOG_DRAIN_ALERT_COOLDOWN_MS;
  });

  it("logs to console without forwarding when drain is not configured", async () => {
    const events: unknown[] = [];
    console.log = (...args: unknown[]) => {
      events.push(...args);
    };

    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response(null, { status: 204 });
    };

    logInfo("test_event", { foo: "bar" });
    await flushMicrotasks();

    assert.equal(events.length > 0, true);
    assert.equal(called, false);
  });

  it("forwards structured payloads when log drain is configured", async () => {
    process.env.LOG_DRAIN_URL = "https://logs.example.com/ingest";
    process.env.LOG_DRAIN_TOKEN = "token-abc";
    process.env.LOG_DRAIN_SOURCE = "next-api";
    const requests: Array<{ input: unknown; init: RequestInit | undefined }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(null, { status: 204 });
    };

    logInfo("queue_processed", { count: 2 });
    await flushMicrotasks();

    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.input, "https://logs.example.com/ingest");
    assert.ok(request.init);
    assert.equal(request.init?.method, "POST");
    const headers = new Headers(request.init?.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("authorization"), "Bearer token-abc");
    assert.ok(typeof request.init?.body === "string");
    const parsed = JSON.parse(request.init?.body as string);
    assert.equal(parsed.event, "queue_processed");
    assert.equal(parsed.forwarderSource, "next-api");
  });

  it("propagates contextual fields into log entries", async () => {
    const payloads: Array<Record<string, unknown>> = [];
    console.log = (value: string) => {
      payloads.push(JSON.parse(value));
    };

    await withLogContext({ requestId: "req-1", userId: "user-42" }, async () => {
      updateLogContext({ saccoId: "sacco-9" });
      logInfo("contextual-event", { ok: true });
    });

    assert.equal(payloads.length, 1);
    const entry = payloads[0];
    assert.equal(entry.requestId, "req-1");
    assert.equal(entry.userId, "user-42");
    assert.equal(entry.saccoId, "sacco-9");
    assert.equal(entry.level, "info");
  });

  it("never throws when forwarding fails", async () => {
    process.env.LOG_DRAIN_URL = "https://logs.example.com/ingest";
    process.env.LOG_DRAIN_SILENT = "1";
    process.env.LOG_DRAIN_ALERT_WEBHOOK = "https://hooks.example.com/drain";
    const requests: Array<{ input: unknown; init: RequestInit | undefined }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      if (requests.length === 1) {
        throw new Error("network down");
      }
      return new Response(null, { status: 202 });
    };

    assert.doesNotThrow(() => {
      logError("drain_failure", { reason: "test" });
    });
    await flushMicrotasks();

    assert.equal(requests.length, 2);
    const [, alertRequest] = requests;
    assert.equal(alertRequest.input, "https://hooks.example.com/drain");
    const headers = new Headers(alertRequest.init?.headers);
    assert.equal(headers.get("content-type"), "application/json");
  });
});
