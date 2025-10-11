const handlerRef: { current: ((req: Request) => Promise<Response>) | null } = {
  current: null,
};

(Deno as typeof Deno & { __FLOW_EXCHANGE_MOCKS__?: unknown })
  .__FLOW_EXCHANGE_MOCKS__ = {
    serve(handler: (req: Request) => Promise<Response>) {
      handlerRef.current = handler;
    },
  };

Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_key");

await import("./index.ts");

if (!handlerRef.current) {
  throw new Error("flow-exchange handler not registered");
}

const handler = handlerRef.current;

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return;
  if (actual !== expected) {
    throw new Error(
      message ?? `Assertion failed: ${String(actual)} !== ${String(expected)}`,
    );
  }
}

Deno.test("returns 405 for non-POST requests", async () => {
  const res = await handler!(
    new Request("https://example.com/flow-exchange", {
      method: "GET",
    }),
  );
  assertEquals(res.status, 405);
});

Deno.test("returns 400 for invalid JSON payload", async () => {
  const res = await handler!(
    new Request("https://example.com/flow-exchange", {
      method: "POST",
      body: "not a json",
      headers: { "content-type": "application/json" },
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("returns 400 for missing required fields", async () => {
  const res = await handler!(
    new Request("https://example.com/flow-exchange", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }),
  );
  assertEquals(res.status, 400);
});
