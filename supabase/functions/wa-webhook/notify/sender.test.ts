Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("WA_PHONE_ID", "000000000000");
Deno.env.set("WA_TOKEN", "token");
Deno.env.set("WA_APP_SECRET", "secret");
Deno.env.set("WA_VERIFY_TOKEN", "verify");
Deno.env.set("VOUCHER_SIGNING_SECRET", "test-secret");

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(message ?? `Assertion failed: ${actual} !== ${expected}`);
  }
}

const { processNotificationQueue } = await import("./sender.ts");

class MockSupabase {
  rows: Array<Record<string, any>>;

  constructor(rows: Array<Record<string, any>>) {
    this.rows = rows;
  }

  rpc(name: string, args: Record<string, unknown>) {
    if (name !== "security.claim_notifications") {
      throw new Error(`Unexpected rpc ${name}`);
    }
    const limit = typeof args?._limit === "number"
      ? (args._limit as number)
      : 10;
    const nowIso = new Date().toISOString();
    const claimed = this.rows
      .filter((row) =>
        row.status === "queued" &&
        (!row.next_attempt_at || row.next_attempt_at <= nowIso)
      )
      .slice(0, limit)
      .map((row) => ({ ...row }));
    for (const claim of claimed) {
      const source = this.rows.find((row) => row.id === claim.id);
      if (source) {
        source.locked_at = nowIso;
      }
    }
    return Promise.resolve({ data: claimed, error: null });
  }

  from(table: string) {
    if (table !== "notifications") {
      throw new Error(`Unexpected table ${table}`);
    }
    const builder: any = {
      filters: [] as Array<{ column: string; value: unknown }>,
      select: (_fields: string) => builder,
      eq: (column: string, value: unknown) => {
        builder.filters.push({ column, value });
        return builder;
      },
      or: (_expr: string) => builder,
      order: (_column: string, _opts: Record<string, unknown>) => builder,
      limit: async (limit: number) => {
        let data = this.rows.slice();
        for (const filter of builder.filters) {
          data = data.filter((row) => row[filter.column] === filter.value);
        }
        const slice = data.slice(0, limit).map((row) => ({
          id: row.id,
          to_wa_id: row.to_wa_id,
          payload: row.payload,
          retry_count: row.retry_count,
        }));
        return { data: slice, error: null };
      },
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          const target = this.rows.find((row) => row[column] === value);
          if (!target) {
            return { error: new Error("Row not found") };
          }
          Object.assign(target, values);
          return { error: null };
        },
      }),
    };
    return builder;
  }
}

function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: `n_${crypto.randomUUID()}`,
    status: "queued",
    locked_at: null,
    to_wa_id: "+250700000001",
    payload: { template: { name: "demo", language: "en", components: [] } },
    retry_count: 0,
    next_attempt_at: null,
    error_message: null,
    ...overrides,
  } as Record<string, any>;
}

Deno.test("processNotificationQueue marks queued notifications as sent", async () => {
  const rows = [buildNotification({ id: "n1" })];
  const mock = new MockSupabase(rows);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    await processNotificationQueue(10, mock as any);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const row = rows[0] as Record<string, any>;
  assertEquals(row.status, "sent");
  assert(row.sent_at);
  assertEquals(row.error_message, null);
});

Deno.test("processNotificationQueue marks failures after max retries", async () => {
  const rows = [buildNotification({ id: "n2", retry_count: 4 })];
  const mock = new MockSupabase(rows);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("boom", { status: 500 });
  try {
    await processNotificationQueue(10, mock as any);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const row = rows[0] as Record<string, any>;
  assertEquals(row.status, "failed");
  assertEquals(row.retry_count, 5);
  assert(row.error_message);
});
