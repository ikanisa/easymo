import { assert, assertEquals, assertMatch } from "$std/assert/mod.ts";
import { RouterService } from "../src/router_service.ts";
import type { KeywordMapping, RouteDestination, RouterLogPayload, RouterRepository } from "../src/types.ts";

class MockRepository implements RouterRepository {
  keywordMappings: KeywordMapping[] = [];
  destinations: RouteDestination[] = [];
  logs: RouterLogPayload[] = [];
  claimed = new Set<string>();
  rateLimitAllowed = true;
  rateLimitCount = 0;

  constructor(opts: { keywords?: KeywordMapping[]; destinations?: RouteDestination[] } = {}) {
    this.keywordMappings = opts.keywords ?? [];
    this.destinations = opts.destinations ?? [];
  }

  async loadKeywordMappings(): Promise<KeywordMapping[]> {
    return this.keywordMappings;
  }

  async loadDestinations(): Promise<RouteDestination[]> {
    return this.destinations;
  }

  async claimMessage(
    messageId: string,
    _waFrom: string,
    _routeKey: string,
    _metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (this.claimed.has(messageId)) {
      return false;
    }
    this.claimed.add(messageId);
    return true;
  }

  async checkRateLimit(
    _waFrom: string,
    _windowSeconds: number,
    _maxMessages: number,
  ): Promise<{ allowed: boolean; currentCount: number }> {
    this.rateLimitCount += 1;
    return { allowed: this.rateLimitAllowed, currentCount: this.rateLimitCount };
  }

  async recordRouterLog(payload: RouterLogPayload): Promise<void> {
    this.logs.push(payload);
  }
}

function createPayload(messageId: string, body: string): Record<string, unknown> {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "123",
                phone_number_id: "123",
              },
              messages: [
                {
                  id: messageId,
                  from: "250788000001",
                  type: "text",
                  text: { body },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

async function createSignedRequest(body: unknown, secret: string): Promise<Request> {
  const json = JSON.stringify(body);
  const signature = await createSignature(json, secret);
  return new Request("https://router.example.com/wa", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    }),
    body: json,
  });
}

async function createSignature(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface FetchCall {
  url: string;
  body: string | undefined;
}

function createFetchMock(response: Response | (() => Response)): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchFn: typeof fetch = async (input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const body = init?.body ? String(init.body) : undefined;
    calls.push({ url, body });
    return typeof response === "function" ? (response as () => Response)() : response;
  };
  return { fetch: fetchFn, calls };
}

Deno.test("RouterService prevents replayed signatures from invoking downstream services", async () => {
  const secret = "test_secret";
  const repository = new MockRepository({
    keywords: [{ keyword: "insurance", routeKey: "insurance" }],
    destinations: [{ routeKey: "insurance", destinationUrl: "https://downstream.example.com", priority: 1 }],
  });
  const fetchMock = createFetchMock(new Response("ok", { status: 200 }));
  const service = new RouterService(repository, {
    verifyToken: "",
    appSecret: secret,
    routerEnabled: true,
    rateLimitWindowSeconds: 60,
    rateLimitMaxMessages: 10,
  }, fetchMock.fetch);

  const payload = createPayload("wamid.1", "insurance");
  const firstRequest = await createSignedRequest(payload, secret);
  const firstResponse = await service.handleRequest(firstRequest);
  assertEquals(firstResponse.status, 200);
  await service.drainFanouts();
  assertEquals(fetchMock.calls.length, 1);

  const replayRequest = await createSignedRequest(payload, secret);
  const replayResponse = await service.handleRequest(replayRequest);
  assertEquals(replayResponse.status, 200);
  await service.drainFanouts();
  assertEquals(fetchMock.calls.length, 1);

  const duplicateLog = repository.logs.find((log) => log.status === "duplicate");
  assert(duplicateLog, "duplicate log should be recorded");
});

Deno.test("RouterService records unknown keywords without fan-out", async () => {
  const secret = "test_secret";
  const repository = new MockRepository();
  const fetchMock = createFetchMock(new Response("ok", { status: 200 }));
  const service = new RouterService(repository, {
    verifyToken: "",
    appSecret: secret,
    routerEnabled: true,
    rateLimitWindowSeconds: 60,
    rateLimitMaxMessages: 10,
  }, fetchMock.fetch);

  const payload = createPayload("wamid.2", "unrecognized keyword");
  const request = await createSignedRequest(payload, secret);
  const response = await service.handleRequest(request);
  assertEquals(response.status, 200);
  await service.drainFanouts();
  assertEquals(fetchMock.calls.length, 0);

  const unmatchedLogs = repository.logs.filter((log) => log.status === "unmatched");
  assertEquals(unmatchedLogs.length, 1);
});

Deno.test("RouterService captures downstream failures in telemetry logs", async () => {
  const secret = "test_secret";
  const repository = new MockRepository({
    keywords: [{ keyword: "basket", routeKey: "basket" }],
    destinations: [{ routeKey: "basket", destinationUrl: "https://downstream.example.com/fail", priority: 1 }],
  });
  const fetchMock = createFetchMock(new Response("fail", { status: 500 }));
  const service = new RouterService(repository, {
    verifyToken: "",
    appSecret: secret,
    routerEnabled: true,
    rateLimitWindowSeconds: 60,
    rateLimitMaxMessages: 10,
  }, fetchMock.fetch);

  const payload = createPayload("wamid.3", "basket");
  const request = await createSignedRequest(payload, secret);
  const response = await service.handleRequest(request);
  assertEquals(response.status, 200);
  await service.drainFanouts();

  const errorLogs = repository.logs.filter((log) => log.status === "error");
  assertEquals(errorLogs.length, 1);
  const metadata = errorLogs[0].metadata as { responses?: Array<Record<string, unknown>> };
  assert(metadata.responses, "downstream responses should be captured");
  assertEquals(Array.isArray(metadata.responses), true);
  assertMatch(JSON.stringify(metadata.responses), /500/);
});
