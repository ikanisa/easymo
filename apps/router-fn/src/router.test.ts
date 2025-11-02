import { assertEquals, assertExists, assertFalse } from "$std/assert/mod.ts";
import { createRouterHandler } from "./router.ts";
import { RouterConfig } from "./config.ts";
import { DestinationRecord, TelemetryRecord } from "./types.ts";
import { RouterRepositoryPort } from "./repository.ts";

class FakeRepository implements RouterRepositoryPort {
  destinations: DestinationRecord[] = [];
  logs: Array<{
    messageId: string;
    statusCode: string;
    metadata: Record<string, unknown>;
  }> = [];
  telemetry: TelemetryRecord[] = [];
  idempotency = new Set<string>();
  allowRate = true;

  async loadDestinations(_allowlist: Set<string>): Promise<DestinationRecord[]> {
    return this.destinations;
  }

  async persistRouterLog(
    messageId: string,
    _textSnippet: string | undefined,
    _routeKey: string | undefined,
    statusCode: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.logs.push({ messageId, statusCode, metadata });
  }

  async recordTelemetry(record: TelemetryRecord): Promise<void> {
    this.telemetry.push(record);
  }

  async upsertIdempotency(messageId: string, _from: string): Promise<{ inserted: boolean }> {
    if (this.idempotency.has(messageId)) {
      return { inserted: false };
    }
    this.idempotency.add(messageId);
    return { inserted: true };
  }

  async enforceRateLimit(
    _sender: string,
    _limit: number,
    _windowSeconds: number,
  ): Promise<{ allowed: boolean; count: number }> {
    return { allowed: this.allowRate, count: this.allowRate ? 1 : 100 };
  }
}

async function createSignedRequest(body: string, secret: string): Promise<Request> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": `sha256=${hex}` },
    body,
  });
}

function baseConfig(): RouterConfig {
  return {
    waVerifyToken: "verify",
    waAppSecret: "secret",
    routerEnabled: true,
    supabaseUrl: undefined,
    supabaseServiceRoleKey: undefined,
    destinationAllowlist: new Set<string>(["default-destination"]),
    rateLimitWindowSeconds: 60,
    rateLimitMaxMessages: 10,
    keywordCacheTtlMs: 1000,
    downstreamFetchTimeoutMs: 1000,
  };
}

async function waitForMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

Deno.test("router handler prevents signature replay via idempotency table", async () => {
  const repository = new FakeRepository();
  repository.destinations = [
    { keyword: "hello", destinationSlug: "default-destination", destinationUrl: "https://dest.example/hello" },
  ];

  const handler = createRouterHandler({
    config: baseConfig(),
    repository,
    fetchFn: (_url, _init) => Promise.resolve(new Response("ok", { status: 200 })),
    uuidFn: () => "test-correlation",
  });

  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1" },
              messages: [
                { id: "wamid.abc", from: "2507", type: "text", text: { body: "hello world" } },
              ],
            },
          },
        ],
      },
    ],
  });

  const firstRequest = await createSignedRequest(body, baseConfig().waAppSecret);
  const secondRequest = await createSignedRequest(body, baseConfig().waAppSecret);

  const firstResponse = await handler(firstRequest);
  assertEquals(firstResponse.status, 200);
  await waitForMicrotasks();

  const secondResponse = await handler(secondRequest);
  assertEquals(secondResponse.status, 200);
  await waitForMicrotasks();

  const duplicateLog = repository.logs.find((log) => log.statusCode === "duplicate");
  assertExists(duplicateLog, "duplicate message should be recorded");
  const routedLogs = repository.logs.filter((log) => log.statusCode === "routed");
  assertEquals(routedLogs.length, 1, "first delivery should be routed once");

  const duplicateTelemetry = repository.telemetry.find((t) => t.event === "message_duplicate");
  assertExists(duplicateTelemetry, "duplicate telemetry should be captured");
});

Deno.test("router handler records telemetry for unknown keywords", async () => {
  const repository = new FakeRepository();
  repository.destinations = [];

  const handler = createRouterHandler({
    config: baseConfig(),
    repository,
    fetchFn: (_url, _init) => {
      throw new Error("should not be called");
    },
    uuidFn: () => "correlation-unknown",
  });

  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1" },
              messages: [
                { id: "wamid.unknown", from: "2507", type: "text", text: { body: "no-match" } },
              ],
            },
          },
        ],
      },
    ],
  });

  const request = await createSignedRequest(body, baseConfig().waAppSecret);
  const response = await handler(request);
  assertEquals(response.status, 200);
  await waitForMicrotasks();

  assertFalse(repository.logs.some((log) => log.statusCode === "routed"));
  const unmatched = repository.telemetry.find((t) => t.event === "keyword_unmatched");
  assertExists(unmatched, "unknown keyword telemetry should be recorded");
});

Deno.test("router handler captures downstream failures in telemetry", async () => {
  const repository = new FakeRepository();
  repository.destinations = [
    { keyword: "fail", destinationSlug: "default-destination", destinationUrl: "https://dest.example/fail" },
  ];

  const handler = createRouterHandler({
    config: baseConfig(),
    repository,
    fetchFn: () => Promise.reject(new Error("downstream boom")),
    uuidFn: () => "correlation-fail",
  });

  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1" },
              messages: [
                { id: "wamid.fail", from: "2507", type: "text", text: { body: "fail" } },
              ],
            },
          },
        ],
      },
    ],
  });

  const request = await createSignedRequest(body, baseConfig().waAppSecret);
  const response = await handler(request);
  assertEquals(response.status, 200);
  await waitForMicrotasks();

  const errorLog = repository.logs.find((log) => log.statusCode === "error");
  assertExists(errorLog, "downstream failure should be logged as error");
  const telemetry = repository.telemetry.find((t) => t.event === "downstream_error");
  assertExists(telemetry, "downstream error telemetry should be recorded");
});
