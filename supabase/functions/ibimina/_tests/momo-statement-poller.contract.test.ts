import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

import {
  PollerConfig,
  processPollers,
  type StructuredLogger,
} from "../momo-statement-poller/index.ts";

interface LogEntry {
  level: "info" | "warn" | "error";
  event: string;
  payload?: Record<string, unknown>;
}

class FakeLogger implements StructuredLogger {
  logs: LogEntry[] = [];

  info(event: string, payload?: Record<string, unknown>) {
    this.logs.push({ level: "info", event, payload });
  }

  warn(event: string, payload?: Record<string, unknown>) {
    this.logs.push({ level: "warn", event, payload });
  }

  error(event: string, payload?: Record<string, unknown>) {
    this.logs.push({ level: "error", event, payload });
  }
}

class FakeQueryBuilder {
  constructor(
    private readonly supabase: FakeSupabase,
    private readonly table: string
  ) {}

  insert(row: Record<string, unknown>, _options?: Record<string, unknown>) {
    const { data, error } = this.supabase.handleInsert(this.table, row);
    return {
      select: () => ({ data, error }),
    };
  }

  update(values: Record<string, unknown>) {
    return {
      eq: (column: string, value: unknown) =>
        this.supabase.handleUpdate(this.table, values, column, value),
    };
  }

  select() {
    return this.supabase.handleSelect(this.table);
  }

  eq(column: string, value: unknown) {
    return this.supabase.handleEq(this.table, column, value);
  }
}

class FakeSupabase {
  stagingByExternalId = new Map<string, Record<string, unknown>>();
  jobsById = new Map<string, Record<string, unknown>>();
  pollerUpdates: Array<{ id: string; values: Record<string, unknown> }> = [];
  rpcCalls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  private stagingCounter = 0;
  private jobCounter = 0;

  schema(_schema: string) {
    return this;
  }

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  rpc(name: string, payload: Record<string, unknown>) {
    this.rpcCalls.push({ name, payload });
    return { data: null, error: null };
  }

  handleInsert(table: string, row: Record<string, unknown>) {
    if (table === "momo_statement_staging") {
      const externalId = String(row.external_id);
      if (this.stagingByExternalId.has(externalId)) {
        return { data: null, error: { code: "23505", message: "duplicate" } };
      }
      const id = `stage-${++this.stagingCounter}`;
      const stored = { ...row, id };
      this.stagingByExternalId.set(externalId, stored);
      return { data: [stored], error: null };
    }

    if (table === "reconciliation_jobs") {
      const id = `job-${++this.jobCounter}`;
      const stored = { ...row, id };
      this.jobsById.set(id, stored);
      return { data: [stored], error: null };
    }

    return { data: [], error: null };
  }

  handleUpdate(table: string, values: Record<string, unknown>, column: string, value: unknown) {
    if (table === "momo_statement_staging" && column === "id") {
      const entry = Array.from(this.stagingByExternalId.values()).find((row) => row.id === value);
      if (entry) {
        Object.assign(entry, values);
      }
      return { data: entry ? [entry] : [], error: null };
    }

    if (table === "momo_statement_pollers" && column === "id") {
      this.pollerUpdates.push({ id: String(value), values });
      return { data: [], error: null };
    }

    return { data: [], error: null };
  }

  handleSelect(_table: string) {
    return { data: [], error: null };
  }

  handleEq(table: string, column: string, value: unknown) {
    if (table === "momo_statement_pollers" && column === "id") {
      return { data: [], error: null };
    }

    if (table === "momo_statement_staging" && column === "id") {
      const entry = Array.from(this.stagingByExternalId.values()).find((row) => row.id === value);
      return { data: entry ? [entry] : [], error: null };
    }

    return { data: [], error: null };
  }
}

describe("momo-statement-poller contract", () => {
  const poller: PollerConfig = {
    id: "poller-1",
    sacco_id: "sacco-123",
    provider: "mtn",
    display_name: "MTN Poller",
    endpoint_url: "https://example.com/poll",
    auth_header: null,
    cursor: null,
    status: "ACTIVE",
  };

  Deno.test("deduplicates staging inserts and queued jobs across runs", async () => {
    const supabase = new FakeSupabase();
    const logger = new FakeLogger();
    const fetcher = () =>
      Promise.resolve({
        statements: [
          { id: "txn-1", occurred_at: new Date().toISOString() },
          { id: "txn-1", occurred_at: new Date().toISOString() },
        ],
        nextCursor: null,
      });

    await processPollers(supabase as never, [poller], logger, fetcher);
    await processPollers(supabase as never, [poller], logger, fetcher);

    assertEquals(supabase.stagingByExternalId.size, 1);
    assertEquals(supabase.jobsById.size, 1);
    assertExists(logger.logs.find((entry) => entry.event === "poller.statement.duplicate"));
  });

  Deno.test("queues reconciliation jobs and marks staging rows as queued", async () => {
    const supabase = new FakeSupabase();
    const logger = new FakeLogger();
    const fetcher = () =>
      Promise.resolve({
        statements: [
          { id: "txn-2", occurred_at: new Date().toISOString() },
          { id: "txn-3", occurred_at: new Date().toISOString() },
        ],
        nextCursor: "cursor-2",
      });

    const result = await processPollers(supabase as never, [poller], logger, fetcher);

    assertEquals(result.inserted, 2);
    assertEquals(result.jobs, 2);

    const queuedRow = supabase.stagingByExternalId.get("txn-2");
    assertExists(queuedRow);
    assertEquals(queuedRow?.status, "QUEUED");
    assertExists(queuedRow?.queued_job_id);

    assertExists(supabase.pollerUpdates.find((update) => update.values.cursor === "cursor-2"));
    assertExists(logger.logs.find((entry) => entry.event === "poller.run.success"));
  });
});
