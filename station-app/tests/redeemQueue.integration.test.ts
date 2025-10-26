import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { StationClient } from "../src/api/stationClient";
import type { RedeemQueueEntry } from "../src/offline/RedeemQueue";
import { RedeemQueue } from "../src/offline/RedeemQueue";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("RedeemQueue integration", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  const tableRows: Array<{ id: string; idempotency_key: string; station_id: string } & Record<string, unknown>> = [];
  const supabaseFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/rest/v1/voucher_redemptions")) {
      const method = init?.method ?? (typeof input === "string" ? "GET" : input.method ?? "GET");
      if (method === "POST") {
        const payload = JSON.parse((init?.body as string) ?? "[]");
        const row = payload[0];
        if (tableRows.some((existing) => existing.idempotency_key === row.idempotency_key)) {
          return new Response(JSON.stringify(tableRows.filter((existing) => existing.idempotency_key === row.idempotency_key)), {
            status: 409,
          });
        }
        tableRows.push(row);
        return new Response(JSON.stringify([row]), { status: 201 });
      }
      if (method === "GET") {
        return new Response(JSON.stringify(tableRows), { status: 200 });
      }
    }
    return new Response(null, { status: 404 });
  });

  const supabase = createClient("https://supabase.local", "anon-key", {
    global: { fetch: supabaseFetch },
  });

  beforeEach(() => {
    tableRows.length = 0;
    supabaseFetch.mockClear();
    if (originalOnLine?.configurable) {
      Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    }
  });

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, "onLine", originalOnLine);
    }
  });

  it("retries with a stable idempotency key and persists a single Supabase row", async () => {
    const keys: string[] = [];
    let shouldFail = true;

    const stationFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/api/station/redeem")) {
        const headers = new Headers(init?.headers);
        const key = headers.get("Idempotency-Key");
        if (!key) {
          return new Response(JSON.stringify({ error: "missing_key" }), { status: 400 });
        }
        keys.push(key);
        if (shouldFail) {
          shouldFail = false;
          throw new Error('network_down');
        }
        const body = JSON.parse((init?.body as string) ?? "{}");
        tableRows.push({
          id: body.voucherCode,
          idempotency_key: key,
          station_id: "station-1",
          status: "redeemed",
        });
        return new Response(
          JSON.stringify({
            status: "redeemed",
            amount: 15000,
            currency: "RWF",
            maskedMsisdn: "+250 78* *** 012",
            redeemedAt: new Date().toISOString(),
            voucherId: body.voucherCode,
            reference: `REF-${body.voucherCode}`,
          }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://supabase.local")) {
        return supabaseFetch(input, init);
      }
      return new Response(null, { status: 404 });
    });

    const client = new StationClient({ token: "token", fetchImpl: stationFetch });
    const storage = new MemoryStorage();
    const completed: RedeemQueueEntry[] = [];

    const queue = new RedeemQueue({
      stationId: "station-1",
      client,
      storage,
      retryDelaysMs: [0],
      onComplete: (entry) => {
        completed.push(entry);
      },
    });

    queue.enqueue({ voucherCode: "12345", method: "code" });

    if (originalOnLine?.configurable) {
      Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    }

    await queue.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await vi.waitFor(() => expect(stationFetch).toHaveBeenCalledTimes(2));
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(1);
    expect(completed).toHaveLength(1);

    const { data: supabaseRows } = await supabase.from("voucher_redemptions").select();
    expect(supabaseRows).toHaveLength(1);
    expect((supabaseRows ?? [])[0]?.idempotency_key).toBe(keys[0]);
  });
});
