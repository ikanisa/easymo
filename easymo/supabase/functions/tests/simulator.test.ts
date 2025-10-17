import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

denoEnv();

function denoEnv() {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ADMIN_TOKEN", "super-secret");
}

Deno.test("simulator drivers returns rpc results", async () => {
  const module = await import("../simulator/index.ts");
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const mockClient = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: [{ user_id: "drv-1" }], error: null });
    },
  };
  module.setSupabaseClientForTesting(mockClient as any);

  const res = await module.handler(new Request("http://localhost/simulator?action=drivers&lat=-1.9&lng=30.0&vehicle_type=moto", {
    headers: new Headers({ "x-admin-token": "super-secret" }),
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.drivers.length, 1);
  assertEquals(rpcCalls[0].name, "simulator_find_nearby_drivers");
});

Deno.test("simulator passengers enforces subscription", async () => {
  const module = await import("../simulator/index.ts");

  const mockClient = {
    rpc(name: string) {
      if (name === "simulator_find_nearby_passenger_trips") {
        return Promise.resolve({ data: { access: true, trips: [] }, error: null });
      }
      throw new Error(`Unexpected rpc ${name}`);
    },
    from(table: string) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq(_column: string, value: string) {
                return {
                  maybeSingle: async () => ({ data: value === "DRV001" ? { user_id: "driver-1" } : null, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "subscriptions") {
        return {
          select() {
            return {
              eq(_column: string, _value: string) {
                return {
                  eq() {
                    return {
                      order() {
                        return {
                          limit() {
                            return Promise.resolve({ data: [], error: null });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  module.setSupabaseClientForTesting(mockClient as any);
  const res = await module.handler(new Request(
    "http://localhost/simulator?action=passengers&lat=-1.9&lng=30.0&vehicle_type=moto&driver_ref_code=DRV001",
    { headers: new Headers({ "x-admin-token": "super-secret" }) },
  ));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.access, false);
  assertEquals(body.reason, "no_subscription");
});
