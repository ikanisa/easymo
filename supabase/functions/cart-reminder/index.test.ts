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
  if (!Deno.env.get(key)) Deno.env.set(key, value);
}

const {
  normalizeWhatsApp,
  parseIntEnv,
  isWithinQuietHours,
} = await import("./index.ts");

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, received ${actual}`);
  }
}

Deno.test("normalizeWhatsApp standardizes phone numbers", () => {
  assertEquals(normalizeWhatsApp("+250780000001"), "+250780000001");
  assertEquals(normalizeWhatsApp("250780000001"), "+250780000001");
  assertEquals(normalizeWhatsApp(""), null);
  assertEquals(normalizeWhatsApp(undefined), null);
});

Deno.test("parseIntEnv respects fallback when invalid", () => {
  const key = "TEST_CART_REMINDER_THRESHOLD";
  Deno.env.delete(key);
  assertEquals(parseIntEnv(key, 5), 5);
  Deno.env.set(key, "30");
  assertEquals(parseIntEnv(key, 10), 30);
  Deno.env.set(key, "not-an-int");
  assertEquals(parseIntEnv(key, 7), 7);
  Deno.env.delete(key);
});

Deno.test("isWithinQuietHours handles wrap-around windows", () => {
  const config = { start: "22:00", end: "06:00" };
  const late = new Date("2024-01-01T23:30:00Z");
  const morning = new Date("2024-01-01T05:30:00Z");
  const noon = new Date("2024-01-01T12:00:00Z");
  assertEquals(isWithinQuietHours(config, late), true);
  assertEquals(isWithinQuietHours(config, morning), true);
  assertEquals(isWithinQuietHours(config, noon), false);
});
(globalThis as { __DISABLE_CART_REMINDER_SERVER__?: boolean })
  .__DISABLE_CART_REMINDER_SERVER__ = true;
