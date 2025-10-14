import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  logStructured: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}));

describe("qr preview route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.WA_BOT_NUMBER_E164 = "+250700000010";
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns preview payload and dispatches a test message", async () => {
    const { getSupabaseAdminClient } = (await import("@/lib/server/supabase-admin")) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Sunset Bar",
        slug: "sunset-bar",
        location_text: "Kigali",
        city_area: null,
        bar_tables: [
          { label: "Table 1", qr_payload: "B:sunset-bar T:Table 1 K:seed" },
        ],
      },
      error: null,
    });

    getSupabaseAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    const { sendWhatsAppMessage } = await import("@/lib/server/whatsapp");
    const sendMock = sendWhatsAppMessage as unknown as Mock;

    const { POST } = await import("@/app/api/qr/preview/route");

    const response = await POST(
      new Request("http://localhost/api/qr/preview", {
        method: "POST",
        body: JSON.stringify({
          barId: "11111111-1111-1111-1111-111111111111",
          phone: "+250780000000",
          sendTest: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.preview.interactive.header).toBe("Choose a bar");
    expect(payload.integration).toMatchObject({ target: "qr_preview", status: "ok" });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("marks preview as degraded when no QR tables exist", async () => {
    const { getSupabaseAdminClient } = (await import("@/lib/server/supabase-admin")) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "22222222-2222-2222-2222-222222222222",
        name: "No Tables Bar",
        slug: "no-tables",
        location_text: null,
        city_area: "Kigali",
        bar_tables: [],
      },
      error: null,
    });

    getSupabaseAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    const { sendWhatsAppMessage } = await import("@/lib/server/whatsapp");
    const sendMock = sendWhatsAppMessage as unknown as Mock;

    const { POST } = await import("@/app/api/qr/preview/route");

    const response = await POST(
      new Request("http://localhost/api/qr/preview", {
        method: "POST",
        body: JSON.stringify({ barId: "22222222-2222-2222-2222-222222222222" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.integration).toMatchObject({ status: "degraded" });
    expect(payload.preview.metadata.sampleTable).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
