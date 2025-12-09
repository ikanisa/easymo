import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { configureAuditClientFactory, configureAuditErrorLogger, logAudit } from "@/lib/audit";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type InsertPayload = {
  action: string;
  entity: string;
  entity_id: string;
  diff: Record<string, unknown> | null;
  actor: string;
};

describe("audit logger", () => {
  afterEach(() => {
    configureAuditClientFactory();
    configureAuditErrorLogger();
  });

  it("writes structured audit entries with the authenticated actor", async () => {
    const inserts: Array<{ table: string; payload: InsertPayload }> = [];
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: "actor-123" } } }),
      },
      from: (table: string) => ({
        insert: async (payload: InsertPayload) => {
          inserts.push({ table, payload });
          return { error: null } as const;
        },
      }),
    } satisfies Record<string, unknown>;

    configureAuditClientFactory(async () => client as unknown as SupabaseClient);

    await logAudit({
      action: "TEST",
      entity: "member",
      entityId: "member-1",
      diff: { status: "ACTIVE" },
    });

    assert.equal(inserts.length, 1);
    const [entry] = inserts;
    assert.equal(entry.table, "app.audit_logs");
    assert.deepEqual(entry.payload, {
      action: "TEST",
      entity: "member",
      entity_id: "member-1",
      diff: { status: "ACTIVE" },
      actor: "actor-123",
    });
  });

  it("logs failures when Supabase rejects the insert", async () => {
    const tables: string[] = [];
    const errors: Array<{ event: string; payload: Record<string, unknown> | undefined }> = [];
    const client = {
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from: (table: string) => ({
        insert: async () => {
          tables.push(table);
          return { error: { message: "duplicate" } };
        },
      }),
    } satisfies Record<string, unknown>;

    configureAuditClientFactory(async () => client as unknown as SupabaseClient);
    configureAuditErrorLogger((event, payload) => {
      errors.push({ event, payload });
    });

    await logAudit({ action: "CREATE", entity: "payment", entityId: "pay-1" });

    assert.equal(errors.length, 1);
    const [{ event, payload }] = errors;
    assert.equal(event, "audit_log_write_failed");
    assert.equal(payload?.entity, "payment");
    assert.equal(payload?.entityId, "pay-1");
    assert.deepEqual(tables, ["app.audit_logs"]);
  });
});
