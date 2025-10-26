import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminApiRequest } from "./utils/api";

const insertSelectMock = vi.fn();
const insertMock = vi.fn(() => ({ select: insertSelectMock }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const invokeMock = vi.fn().mockResolvedValue({});

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: fromMock,
    functions: {
      invoke: invokeMock,
    },
  }),
}));

describe("mobility ping drivers route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    insertMock.mockReset();
    insertSelectMock.mockReset();
    fromMock.mockClear();
    invokeMock.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it("queues notifications via Supabase and triggers worker", async () => {
    insertSelectMock.mockResolvedValueOnce({
      data: [{ id: "notif-1" }, { id: "notif-2" }],
      error: null,
    });

    const { POST } = await import("@/app/api/mobility/ping_drivers/route");

    const response = await POST(
      createAdminApiRequest(
        ["mobility", "ping_drivers"],
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ride_id: "ride-1",
            driver_ids: ["driver-a", "driver-b"],
            template: { name: "DRIVER_PING" },
          }),
        },
      ) as any,
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload).toMatchObject({ ride_id: "ride-1", queued: 2 });

    expect(fromMock).toHaveBeenCalledWith("notifications");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedRows = insertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({
      to_wa_id: "driver-a",
      notification_type: "DRIVER_PING",
      channel: "template",
      metadata: { ride_id: "ride-1" },
    });
    expect(invokeMock).toHaveBeenCalledWith("notification-worker", { body: {} });
  });

  it("returns 400 when payload is invalid", async () => {
    const { POST } = await import("@/app/api/mobility/ping_drivers/route");
    const response = await POST(
      createAdminApiRequest(
        ["mobility", "ping_drivers"],
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ride_id: "", driver_ids: [] }),
        },
      ) as any,
    );

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
