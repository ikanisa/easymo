Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
Deno.env.set("WA_PHONE_ID", "000000000000");
Deno.env.set("WA_TOKEN", "token");
Deno.env.set("WA_APP_SECRET", "secret");
Deno.env.set("WA_VERIFY_TOKEN", "verify");

import type { RouterContext } from "../types.ts";

const { IDS } = await import("../wa/ids.ts");
const waClient = await import("../wa/client.ts");
const nearby = await import("./nearby.ts");
const schedule = await import("./schedule.ts");

const { handleSeePassengers, handleVehicleSelection } = nearby;
const { handleScheduleRole, handleScheduleVehicle } = schedule;

class MockSupabaseClient {
  profile: {
    user_id: string;
    vehicle_plate?: string | null;
    vehicle_type?: string | null;
    metadata?: Record<string, unknown>;
  };
  stateHistory: Array<{ key: string; data?: Record<string, unknown> }> = [];

  constructor(
    profile: Partial<
      { vehicle_plate: string | null; vehicle_type: string | null }
    > = {},
  ) {
    this.profile = {
      user_id: "user-1",
      vehicle_plate: profile.vehicle_plate ?? null,
      vehicle_type: profile.vehicle_type ?? null,
      metadata: {},
    };
  }

  from(table: string) {
    if (table === "profiles") {
      const builder = {
        select: (_fields: string) => builder,
        eq: (_column: string, _value: unknown) => builder,
        maybeSingle: async () => ({
          data: {
            vehicle_plate: this.profile.vehicle_plate ?? null,
            vehicle_type: this.profile.vehicle_type ?? null,
            metadata: this.profile.metadata ?? {},
          },
          error: null,
        }),
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            this.profile = { ...this.profile, ...values };
            return { error: null };
          },
        }),
      };
      return builder;
    }
    if (table === "chat_state") {
      return {
        upsert: (payload: Record<string, unknown>) => ({
          eq: async () => {
            this.stateHistory.push(
              payload.state as {
                key: string;
                data?: Record<string, unknown>;
              },
            );
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

function buildRouterContext(
  supabase: MockSupabaseClient,
): RouterContext {
  return {
    supabase: supabase as unknown as RouterContext["supabase"],
    from: "+250700000000",
    profileId: supabase.profile.user_id,
    locale: "en" as RouterContext["locale"],
  };
}

function installWhatsAppStubs() {
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.body) {
      try {
        const payload = JSON.parse(init.body as string);
        requests.push(payload);
      } catch {
        // ignore parse errors for non-JSON payloads
      }
    }
    return new Response("{}", { status: 200 });
  };
  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

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

Deno.test("handleSeePassengers prompts vehicle selection when no default stored", async () => {
  const supabase = new MockSupabaseClient({
    vehicle_plate: "RAA123C",
    vehicle_type: null,
  });
  const ctx = buildRouterContext(supabase);
  const stubs = installWhatsAppStubs();
  try {
    const result = await handleSeePassengers(ctx);
    assert(result === true);
    const interactive = stubs.requests.filter((payload) =>
      payload?.type === "interactive"
    );
    assertEquals(
      interactive.length,
      1,
      "Expected a single interactive message",
    );
    const first = interactive[0] as
      | { interactive?: { type?: string } }
      | undefined;
    assertEquals(first?.interactive?.type, "list");
    assertEquals(supabase.stateHistory.length, 1);
    assertEquals(supabase.stateHistory[0], {
      key: "mobility_nearby_select",
      data: { mode: "passengers" },
    });
  } finally {
    stubs.restore();
  }
});

Deno.test("handleSeePassengers reuses stored vehicle and prompts location", async () => {
  const supabase = new MockSupabaseClient({
    vehicle_plate: "RAA123C",
    vehicle_type: "moto",
  });
  const ctx = buildRouterContext(supabase);
  const stubs = installWhatsAppStubs();
  try {
    const result = await handleSeePassengers(ctx);
    assert(result === true);
    const interactive = stubs.requests.filter((payload) =>
      payload?.type === "interactive"
    );
    assertEquals(
      interactive.length,
      1,
      "Expected a single interactive message",
    );
    const first = interactive[0] as
      | { interactive?: { type?: string } }
      | undefined;
    assertEquals(first?.interactive?.type, "button");
    assertEquals(supabase.stateHistory.length, 1);
    assertEquals(supabase.stateHistory[0], {
      key: "mobility_nearby_location",
      data: { mode: "passengers", vehicle: "moto" },
    });
  } finally {
    stubs.restore();
  }
});

Deno.test("handleVehicleSelection stores driver vehicle type", async () => {
  const supabase = new MockSupabaseClient({
    vehicle_plate: "RAA123C",
    vehicle_type: null,
  });
  const ctx = buildRouterContext(supabase);
  const stubs = installWhatsAppStubs();
  try {
    const state = { mode: "passengers" as const };
    const handled = await handleVehicleSelection(ctx, state, "veh_moto");
    assert(handled);
    assertEquals(supabase.profile.vehicle_type, "moto");
    const interactive = stubs.requests.filter((payload) =>
      payload?.type === "interactive"
    );
    assertEquals(interactive.length, 1);
    const first = interactive[0] as
      | { interactive?: { type?: string } }
      | undefined;
    assertEquals(first?.interactive?.type, "button");
    assertEquals(supabase.stateHistory.at(-1), {
      key: "mobility_nearby_location",
      data: { mode: "passengers", vehicle: "moto" },
    });
  } finally {
    stubs.restore();
  }
});

Deno.test("handleScheduleRole skips selection when driver defaults exist", async () => {
  const supabase = new MockSupabaseClient({
    vehicle_plate: "RAA123C",
    vehicle_type: "moto",
  });
  const ctx = buildRouterContext(supabase);
  const stubs = installWhatsAppStubs();
  try {
    const handled = await handleScheduleRole(ctx, IDS.ROLE_DRIVER);
    assert(handled);
    const interactive = stubs.requests.filter((payload) =>
      payload?.type === "interactive"
    );
    assertEquals(interactive.length, 1);
    const first = interactive[0] as
      | { interactive?: { type?: string } }
      | undefined;
    assertEquals(first?.interactive?.type, "button");
    assertEquals(supabase.stateHistory.at(-1), {
      key: "mobility_schedule_location",
      data: { role: "driver", vehicle: "moto" },
    });
  } finally {
    stubs.restore();
  }
});

Deno.test("handleScheduleVehicle updates stored vehicle type for driver", async () => {
  const supabase = new MockSupabaseClient({
    vehicle_plate: "RAA123C",
    vehicle_type: "moto",
  });
  const ctx = buildRouterContext(supabase);
  const stubs = installWhatsAppStubs();
  try {
    const state = { role: "driver" as const };
    const handled = await handleScheduleVehicle(ctx, state, "veh_lifan");
    assert(handled);
    assertEquals(supabase.profile.vehicle_type, "lifan");
    const interactive = stubs.requests.filter((payload) =>
      payload?.type === "interactive"
    );
    assertEquals(interactive.length, 1);
    const first = interactive[0] as
      | { interactive?: { type?: string } }
      | undefined;
    assertEquals(first?.interactive?.type, "button");
    assertEquals(supabase.stateHistory.at(-1), {
      key: "mobility_schedule_location",
      data: { role: "driver", vehicle: "lifan" },
    });
  } finally {
    stubs.restore();
  }
});
