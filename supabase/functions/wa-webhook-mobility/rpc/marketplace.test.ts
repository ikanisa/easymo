import { listBusinesses } from "./marketplace.ts";

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

type RpcResponse = { data: unknown; error: { message: string } | null };

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message ??
        `Assertion failed: ${JSON.stringify(actual)} !== ${
          JSON.stringify(expected)
        }`,
    );
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedMessage?: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (error) {
    threw = true;
    if (expectedMessage) {
      assert(
        typeof error === "object" && error !== null && "message" in error,
        "expected an error object",
      );
      assert(
        String((error as { message?: unknown }).message).includes(
          expectedMessage,
        ),
        `expected error message to include ${expectedMessage}`,
      );
    }
  }
  assert(threw, "expected promise to reject");
}

class StubSupabaseClient {
  readonly calls: RpcCall[] = [];
  private readonly responses: Record<string, RpcResponse[]>;

  constructor(responses: Record<string, RpcResponse[]>) {
    this.responses = responses;
  }

  async rpc(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    const queue = this.responses[name] ?? [];
    if (!queue.length) {
      return { data: null, error: { message: `no mock for ${name}` } };
    }
    const next = queue.shift()!;
    return next;
  }
}

Deno.test("listBusinesses returns primary result when v2 succeeds", async () => {
  const client = new StubSupabaseClient({
    nearby_businesses_v2: [{ data: [{ id: "biz_v2" }], error: null }],
  });

  const result = await listBusinesses(
    client as unknown as any,
    { lat: 1, lng: 2 },
    "food",
    5,
  );

  assertEquals(result, [{ id: "biz_v2" }]);
  assertEquals(client.calls.length, 1);
  assertEquals(client.calls[0].name, "nearby_businesses_v2");
});

Deno.test("listBusinesses falls back with category when v2 fails", async () => {
  const client = new StubSupabaseClient({
    nearby_businesses_v2: [{ data: null, error: { message: "not available" } }],
    nearby_businesses: [{ data: [{ id: "biz_v1" }], error: null }],
  });

  const result = await listBusinesses(
    client as unknown as any,
    { lat: 0, lng: 0 },
    "fashion",
    3,
  );

  assertEquals(result, [{ id: "biz_v1" }]);
  assertEquals(client.calls.length, 2);
  assertEquals(client.calls[1].args._category, "fashion");
});

Deno.test("listBusinesses omits category when legacy RPC rejects the arg", async () => {
  const client = new StubSupabaseClient({
    nearby_businesses_v2: [{ data: null, error: { message: "not available" } }],
    nearby_businesses: [
      { data: null, error: { message: "unknown arg _category" } },
      { data: [{ id: "biz_plain" }], error: null },
    ],
  });

  const result = await listBusinesses(
    client as unknown as any,
    { lat: 0, lng: 0 },
    "services",
    3,
  );

  assertEquals(result, [{ id: "biz_plain" }]);
  assertEquals(client.calls.length, 3);
  assertEquals(client.calls[2].args._category, undefined);
});

Deno.test("listBusinesses throws when all fallbacks fail", async () => {
  const client = new StubSupabaseClient({
    nearby_businesses_v2: [{ data: null, error: { message: "v2 down" } }],
    nearby_businesses: [
      { data: null, error: { message: "missing" } },
    ],
  });

  let thrown = false;
  try {
    await listBusinesses(client as unknown as any, { lat: 0, lng: 0 }, "", 2);
  } catch (error) {
    thrown = true;
    if (
      error && typeof error === "object" &&
      "message" in (error as Record<string, unknown>)
    ) {
      assertEquals((error as Record<string, unknown>).message, "missing");
    }
  }
  assert(thrown, "expected an error to be thrown");
});

Deno.test("listBusinesses surfaces permission errors before fallbacks", async () => {
  const client = new StubSupabaseClient({
    nearby_businesses_v2: [
      {
        data: null,
        error: { message: "permission denied for table business" },
      },
    ],
    nearby_businesses: [
      { data: [{ id: "should_not_use" }], error: null },
    ],
  });

  await assertRejects(
    () =>
      listBusinesses(client as unknown as any, { lat: 0, lng: 0 }, "food", 2),
    "permission denied",
  );
  assertEquals(client.calls.length, 1);
});
