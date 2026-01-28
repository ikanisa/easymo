import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { rankMatches } from "../../src/web/matchService";
import { ensureSessionCanPost } from "../../src/web/moderationService";
import { dispatchQueuedNotifications } from "../../src/web/notificationDispatcher";

process.env.WHATSAPP_SEND_ENDPOINT = process.env.WHATSAPP_SEND_ENDPOINT ?? "https://fake.whatsapp/send";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const mockClient = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../../src/web/client", () => ({
  getWebSupabaseClient: () => mockClient,
}));

const writeAuditMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../../src/audit/writeAuditEvent", () => ({
  writeAuditEvent: writeAuditMock,
}));

describe("web marketplace services", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    mockClient.from.mockReset();
    writeAuditMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("caps ranking deltas at +/-15 and keeps reasons explainable", () => {
    const subject = {
      id: "subject",
      session_id: "session-1",
      type: "buy",
      category: "electronics",
      title: "Looking for a refurbished phone",
      description: "Need an iPhone with warranty",
      price_min: 200000,
      price_max: 250000,
      currency: "RWF",
      location_text: "Kigali",
      geo: { latitude: -1.95, longitude: 30.05 },
      media_urls: [],
      status: "draft",
      created_at: new Date().toISOString(),
      posted_at: null,
    } as const;

    const candidate = {
      target_id: "candidate-1",
      type: "sell",
      category: "electronics",
      title: "Smartphone with charger",
      description: "Selling iPhone 12, RWF 230000",
      price_min: 220000,
      price_max: 240000,
      geo: { latitude: -1.95, longitude: 30.05 },
      posted_at: new Date().toISOString(),
    };

    const matches = rankMatches(subject as unknown as typeof subject, [candidate]);
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(65);
    const totalDelta = matches[0].reasons.reduce((sum, reason) => sum + (reason.score_delta ?? 0), 0);
    expect(totalDelta).toBeLessThanOrEqual(15);
    expect(matches[0].reasons.some((reason) => reason.code === "PRICE")).toBe(true);
  });

  it("blocks sessions that exceed anonymous rate limits", async () => {
    mockClient.from.mockImplementation((table: string) => {
      if (table === "market_posts") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ count: 4, error: null }),
            }),
          }),
        };
      }
      if (table === "moderation_events") {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      return {};
    });

    await expect(ensureSessionCanPost("session-locked")).rejects.toThrow("rate_limit_exceeded");
  });

  it("dispatches queued WhatsApp notifications and marks them sent", async () => {
    const selectChain = {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  id: "notif-1",
                  post_id: "post-1",
                  target_type: "seller_session",
                  target_id: "session-target",
                  channel: "whatsapp",
                  payload: { whatsapp_number: "+250788100000", message: "New match" },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      }),
    };

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === "web_notifications" && callCount === 0) {
        callCount += 1;
        return selectChain;
      }
      return updateChain;
    });

    const results = await dispatchQueuedNotifications();
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        delivered_at: expect.any(String),
        error_message: null,
      }),
    );
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "web_notification.dispatch" }),
    );
  });

  it("marks missing phone notifications as failed", async () => {
    const selectChain = {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  id: "notif-2",
                  post_id: "post-2",
                  target_type: "buyer_session",
                  target_id: "session-2",
                  channel: "whatsapp",
                  payload: { message: "Missing phone" },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      }),
    };

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === "web_notifications" && callCount === 0) {
        callCount += 1;
        return selectChain;
      }
      return updateChain;
    });

    const results = await dispatchQueuedNotifications();
    expect(results[0].status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        delivered_at: null,
        error_message: "whatsapp_missing_target_phone",
      }),
    );
  });
});
