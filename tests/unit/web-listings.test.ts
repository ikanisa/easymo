import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListingInquiry } from "../../src/web/listingService";

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

const queueListingNotificationsMock = vi.hoisted(() => vi.fn().mockResolvedValue(["notif-1"]));
vi.mock("../../src/web/notificationService", () => ({
  queueListingNotifications: queueListingNotificationsMock,
}));

describe("listingService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockClient.from.mockReset();
  });

  it("creates inquiry and queues web + whatsapp notifications when seller is a verified, opted-in vendor", async () => {
    const listingId = "listing-1";
    const sellerSessionId = "seller-session";
    const vendorId = "vendor-1";

    mockClient.from.mockImplementation((table: string) => {
      if (table === "product_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: listingId,
                    session_id: sellerSessionId,
                    vendor_id: vendorId,
                    is_verified_seller: true,
                    status: "published",
                    vendors: {
                      business_name: "Vendor One",
                      phone: "+250788100000",
                      verified: true,
                      is_opted_in: true,
                      is_opted_out: false,
                    },
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "listing_inquiries") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "inq-1",
                    listing_id: listingId,
                    buyer_session_id: "buyer-session",
                    message: "Hello",
                    status: "sent",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    });

    await createListingInquiry({ listing_id: listingId, buyer_session_id: "buyer-session", message: "Hello" });

    expect(queueListingNotificationsMock).toHaveBeenCalledTimes(1);
    expect(queueListingNotificationsMock).toHaveBeenCalledWith(
      listingId,
      expect.arrayContaining([
        expect.objectContaining({ target_type: "seller_session", target_id: sellerSessionId, channel: "web" }),
        expect.objectContaining({ target_type: "vendor", target_id: vendorId, channel: "whatsapp" }),
      ]),
    );
  });

  it("does not queue whatsapp when vendor is not verified", async () => {
    const listingId = "listing-2";
    const sellerSessionId = "seller-session-2";

    mockClient.from.mockImplementation((table: string) => {
      if (table === "product_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: listingId,
                    session_id: sellerSessionId,
                    vendor_id: "vendor-2",
                    is_verified_seller: false,
                    status: "published",
                    vendors: {
                      business_name: "Vendor Two",
                      phone: "+250788200000",
                      verified: false,
                      is_opted_in: true,
                      is_opted_out: false,
                    },
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "listing_inquiries") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "inq-2",
                    listing_id: listingId,
                    buyer_session_id: "buyer-session-2",
                    message: "Ping",
                    status: "sent",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    });

    await createListingInquiry({ listing_id: listingId, buyer_session_id: "buyer-session-2", message: "Ping" });

    expect(queueListingNotificationsMock).toHaveBeenCalledTimes(1);
    const [, targets] = queueListingNotificationsMock.mock.calls[0] as [string, any[]];
    expect(targets).toHaveLength(1);
    expect(targets[0].target_type).toBe("seller_session");
  });
});

