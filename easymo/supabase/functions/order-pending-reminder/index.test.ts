const REQUIRED_ENVS: Record<string, string> = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  WA_PHONE_ID: "1234567890",
  WA_TOKEN: "token",
  WA_APP_SECRET: "appsecret",
  WA_VERIFY_TOKEN: "verify",
  WA_BOT_NUMBER_E164: "+250780000000",
  VOUCHER_SIGNING_SECRET: "signing-secret",
};

for (const [key, value] of Object.entries(REQUIRED_ENVS)) {
  if (!Deno.env.get(key)) {
    Deno.env.set(key, value);
  }
}

const {
  collectRecipients,
  hasVendorNudge,
  parseIntegerEnv,
} = await import("./index.ts");

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      throw new Error(
        message ??
          `Array length mismatch: ${actual.length} !== ${expected.length}`,
      );
    }
    for (let i = 0; i < actual.length; i += 1) {
      if (actual[i] !== expected[i]) {
        throw new Error(message ?? `Array mismatch at index ${i}`);
      }
    }
    return;
  }
  if (actual !== expected) {
    throw new Error(message ?? `Assertion failed: ${actual} !== ${expected}`);
  }
}

Deno.test("collectRecipients merges active numbers and staff fallback", () => {
  const recipients = collectRecipients({
    id: "order-1",
    bar_id: "bar-1",
    created_at: new Date().toISOString(),
    bar: {
      bar_numbers: [
        { number_e164: "+250780000001", is_active: true },
        { number_e164: "+250780000002", is_active: false },
        { number_e164: "250780000003", is_active: true },
      ],
    },
    staff_number: "250780000003",
  });

  assertEquals(
    recipients.sort(),
    [
      "+250780000001",
      "+250780000003",
    ].sort(),
  );
});

Deno.test("hasVendorNudge detects existing events", () => {
  assert(hasVendorNudge({
    id: "order-2",
    bar_id: "bar-1",
    created_at: new Date().toISOString(),
    order_events: [
      { type: "created" },
      { event_type: "vendor_nudge" },
    ],
  }));

  assert(
    !hasVendorNudge({
      id: "order-3",
      bar_id: "bar-1",
      created_at: new Date().toISOString(),
      order_events: [
        { type: "created" },
        { event_type: "paid" },
      ],
    }),
  );
});

Deno.test("parseIntegerEnv falls back for invalid or missing values", () => {
  const key = "TEST_PENDING_THRESHOLD";
  Deno.env.delete(key);
  assertEquals(parseIntegerEnv(key, 10), 10);

  Deno.env.set(key, "30");
  assertEquals(parseIntegerEnv(key, 5), 30);

  Deno.env.set(key, "not-a-number");
  assertEquals(parseIntegerEnv(key, 7), 7);
  Deno.env.delete(key);
});
