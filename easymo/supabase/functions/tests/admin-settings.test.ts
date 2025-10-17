import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

denoEnv();

function denoEnv() {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ADMIN_TOKEN", "super-secret");
}

Deno.test("admin-settings requires authentication", async () => {
  const module = await import("../admin-settings/index.ts");
  module.setSupabaseClientForTesting(null);
  const res = await module.handler(new Request("http://localhost/settings", { method: "GET" }));
  assertEquals(res.status, 401);
});

Deno.test("admin-settings updates and returns settings", async () => {
  const module = await import("../admin-settings/index.ts");

  let currentSettings = {
    subscription_price: 5000,
    search_radius_km: 5,
    max_results: 10,
    momo_payee_number: "0780000000",
    support_phone_e164: "+250780000000",
    admin_whatsapp_numbers: ["+250780001111"],
    updated_at: new Date().toISOString(),
  };
  const updateCalls: unknown[] = [];

  const mockClient = {
    from(table: string) {
      if (table !== "settings") throw new Error(`Unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              return {
                single: async () => ({ data: currentSettings, error: null }),
              };
            },
          };
        },
        update(data: Record<string, unknown>) {
          updateCalls.push(data);
          currentSettings = { ...currentSettings, ...data };
          return {
            eq() {
              return { error: null };
            },
          };
        },
      };
    },
  };

  module.setSupabaseClientForTesting(mockClient as any);

  const res = await module.handler(new Request("http://localhost/settings", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "x-admin-token": "super-secret",
    }),
    body: JSON.stringify({ subscription_price: 6000, admin_whatsapp_numbers: ["+250780009999"] }),
  }));

  assertEquals(res.status, 200);
  assertEquals(updateCalls.length, 1);
  assertEquals((updateCalls[0] as Record<string, unknown>).subscription_price, 6000);

  const body = await res.json();
  assertEquals(body.settings.subscription_price, 6000);
  assertEquals(body.settings.admin_whatsapp_numbers[0], "+250780009999");
});
