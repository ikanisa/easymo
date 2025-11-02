import { assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const schemaPath = new URL("../../../latest_schema.sql", import.meta.url);

async function loadSchema(): Promise<string> {
  return await Deno.readTextFile(schemaPath);
}

function expectForceRls(schema: string, table: string) {
  const enable = new RegExp(
    `ALTER TABLE\\s+"public"\\."${table}"\\s+ENABLE ROW LEVEL SECURITY`,
    "i",
  );
  const force = new RegExp(
    `ALTER TABLE\\s+"public"\\."${table}"\\s+FORCE ROW LEVEL SECURITY`,
    "i",
  );
  assert(enable.test(schema), `Expected ENABLE RLS on ${table}`);
  assert(force.test(schema), `Expected FORCE RLS on ${table}`);
}

function expectPolicy(schema: string, table: string, policy: string) {
  const pattern = new RegExp(
    `CREATE POLICY\\s+"?${policy}"?\\s+ON\\s+"public"\\."${table}"`,
    "i",
  );
  assert(pattern.test(schema), `Missing policy ${policy} on ${table}`);
}

Deno.test("core messaging tables have enforced RLS policies", async () => {
  const schema = await loadSchema();
  const tables: Record<string, string[]> = {
    vouchers: [
      "vouchers_admin_manage",
      "vouchers_admin_read",
      "vouchers_owner_read",
      "vouchers_station_read",
    ],
    voucher_events: [
      "voucher_events_admin_manage",
      "voucher_events_admin_read",
      "voucher_events_station_read",
    ],
    campaigns: [
      "campaigns_admin_manage",
      "campaigns_admin_read",
    ],
    campaign_targets: [
      "campaign_targets_admin_manage",
    ],
    insurance_quotes: [
      "insurance_quotes_admin_manage",
      "insurance_quotes_admin_read",
      "insurance_quotes_owner_read",
    ],
    stations: [
      "stations_admin_manage",
      "stations_admin_read",
      "stations_operator_read",
    ],
    settings: [
      "settings_admin_manage",
      "settings_admin_read",
    ],
    audit_log: [
      "audit_log_admin_read",
      "audit_log_admin_append",
    ],
  };

  for (const [table, policies] of Object.entries(tables)) {
    expectForceRls(schema, table);
    for (const policy of policies) {
      expectPolicy(schema, table, policy);
    }
  }
});

Deno.test("mobility domain tables enforce owner policies", async () => {
  const schema = await loadSchema();
  const tables: Record<string, string[]> = {
    user_favorites: [
      "user_favorites_owner_rw",
      "user_favorites_service_rw",
    ],
    driver_parking: [
      "driver_parking_owner_rw",
      "driver_parking_service_rw",
    ],
    driver_availability: [
      "driver_availability_owner_rw",
      "driver_availability_service_rw",
    ],
    recurring_trips: [
      "recurring_trips_owner_rw",
      "recurring_trips_service_rw",
    ],
    deeplink_tokens: [
      "deeplink_tokens_service_rw",
      "deeplink_tokens_service_ro",
    ],
    deeplink_events: [
      "deeplink_events_service_rw",
    ],
    router_logs: [
      "router_logs_service_rw",
      "router_logs_authenticated_read",
    ],
  };

  for (const [table, policies] of Object.entries(tables)) {
    expectForceRls(schema, table);
    for (const policy of policies) {
      expectPolicy(schema, table, policy);
    }
  }
});

Deno.test("admin helpers exist for RLS evaluation", async () => {
  const schema = await loadSchema();
  for (const fn of [
    "CREATE FUNCTION public.is_admin()",
    "CREATE FUNCTION public.is_admin_reader()",
    "CREATE FUNCTION public.station_scope_matches",
  ]) {
    assert(
      schema.toLowerCase().includes(fn.toLowerCase()),
      `Expected to find helper ${fn}`,
    );
  }
});
