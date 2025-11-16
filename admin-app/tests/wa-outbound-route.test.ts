import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminApiRequest } from "./utils/api";

const insertSelectMock = vi.fn();
const selectMock = vi.fn(() => ({ single: insertSelectMock }));
const insertMock = vi.fn(() => ({ select: selectMock }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const invokeMock = vi.fn().mockResolvedValue({});

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: fromMock,
    functions: { invoke: invokeMock },
  }),
}));

describe("wa outbound messages route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    insertSelectMock.mockResolvedValue({ data: { id: "notif-123" }, error: null });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("queues a notification and triggers worker", async () => {
    const { POST } = await import("@/app/api/wa/outbound/messages/route");

    const response = await POST(
      createAdminApiRequest(["wa", "outbound", "messages"], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: "+123", text: "hello" }),
      }),
    );

    expect(response.status).toBe(202);
    expect(fromMock).toHaveBeenCalledWith("notifications");
    expect(insertMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("notification-worker", { body: {} });
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("@/app/api/wa/outbound/messages/route");
    const response = await POST(
      createAdminApiRequest(["wa", "outbound", "messages"], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: "", text: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
