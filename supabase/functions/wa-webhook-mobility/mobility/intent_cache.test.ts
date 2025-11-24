Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");

import {
  getIntentTtlMs,
  getRecentNearbyIntent,
  storeNearbyIntent,
} from "./intent_cache.ts";
import type { SupabaseClient } from "../../deps.ts";

type ProfilesMetadata = Record<string, unknown>;

class MockSupabaseClient {
  metadata: ProfilesMetadata;

  constructor(options: { metadata?: ProfilesMetadata } = {}) {
    this.metadata = options.metadata ? clone(options.metadata) : {};
  }

  from(table: string) {
    if (table !== "profiles") {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      select: (_fields: string) => ({
        eq: (_column: string, _value: unknown) => ({
          maybeSingle: async () => ({
            data: { metadata: clone(this.metadata) },
            error: null,
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          if (isRecord(values.metadata)) {
            this.metadata = clone(values.metadata);
          }
          return { error: null };
        },
      }),
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

Deno.test("storeNearbyIntent preserves existing metadata entries", async () => {
  const existingTimestamp = "2024-01-01T00:00:00.000Z";
  const client = new MockSupabaseClient({
    metadata: {
      foo: "bar",
      mobility: {
        previous: true,
        nearby: {
          passengers: {
            vehicle: "cab",
            lat: -1.9,
            lng: 30.1,
            capturedAt: existingTimestamp,
          },
        },
      },
    },
  });
  await storeNearbyIntent(
    client as unknown as SupabaseClient,
    "user-1",
    "drivers",
    { vehicle: "Moto", lat: -1.95, lng: 30.05 },
    "2024-01-01T00:05:00.000Z",
  );
  const metadata = client.metadata;
  assertEquals(metadata.foo, "bar");
  assert(isRecord(metadata.mobility));
  const mobility = metadata.mobility as Record<string, unknown>;
  assertEquals(mobility.previous, true);
  assert(isRecord(mobility.nearby));
  const nearby = mobility.nearby as Record<string, unknown>;
  assert(isRecord(nearby.passengers));
  const passengers = nearby.passengers as Record<string, unknown>;
  assertEquals(passengers.vehicle, "cab");
  assertEquals(passengers.capturedAt, existingTimestamp);
  assert(isRecord(nearby.drivers));
  const drivers = nearby.drivers as Record<string, unknown>;
  assertEquals(drivers.vehicle, "moto");
  assertEquals(drivers.lat, -1.95);
  assertEquals(drivers.lng, 30.05);
  assertEquals(drivers.capturedAt, "2024-01-01T00:05:00.000Z");
});

Deno.test("getRecentNearbyIntent respects ttl window", async () => {
  const client = new MockSupabaseClient();
  await storeNearbyIntent(
    client as unknown as SupabaseClient,
    "user-1",
    "drivers",
    { vehicle: "Moto", lat: -1.95, lng: 30.05 },
    "2024-01-01T00:00:00.000Z",
  );
  const withinTtl = await getRecentNearbyIntent(
    client as unknown as SupabaseClient,
    "user-1",
    "drivers",
    Date.parse("2024-01-01T00:08:00.000Z"),
  );
  assert(withinTtl);
  assertEquals(withinTtl?.vehicle, "moto");

  const ttlMs = getIntentTtlMs();
  const expiredAt = new Date(
    Date.parse("2024-01-01T00:00:00.000Z") + ttlMs + 1000,
  ).toISOString();
  const expired = await getRecentNearbyIntent(
    client as unknown as SupabaseClient,
    "user-1",
    "drivers",
    Date.parse(expiredAt),
  );
  assertEquals(expired, null);
});
