import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('@/lib/server/feature-flags', () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/server/whatsapp', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}));

describe('basket create route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it('creates basket, issues token, and sends WhatsApp confirmation', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const creatorUuid = '11111111-1111-1111-1111-111111111111';
    const basketSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'basket-123',
        name: 'My Basket',
        creator_id: creatorUuid,
        created_at: '2025-10-10T00:00:00Z',
      },
      error: null,
    });
    const basketSelect = vi.fn().mockReturnValue({ single: basketSingle });
    const basketInsert = vi.fn().mockReturnValue({ select: basketSelect });

    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'token-111',
        basket_id: 'basket-123',
        token: 'abc123',
        expires_at: '2025-11-01T00:00:00Z',
      },
      error: null,
    });

    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'baskets') {
          return { insert: basketInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      },
      rpc,
    });

    const { POST } = await import('@/app/api/baskets/create/route');

    const response = await POST(
      new Request('http://localhost/api/baskets/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'My Basket',
          creatorId: creatorUuid,
          creatorMsisdn: '+250780000000',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({ basketId: 'basket-123', deeplink: expect.stringContaining('https://easymo.link/join?t=') });
    expect(rpc).toHaveBeenCalledWith('issue_basket_invite_token', expect.objectContaining({
      _basket_id: 'basket-123',
      _created_by: creatorUuid,
    }));

    const { sendWhatsAppMessage } = await import('@/lib/server/whatsapp');
    const sendMock = sendWhatsAppMessage as unknown as Mock;
    expect(sendMock).toHaveBeenCalled();
    const waPayload = sendMock.mock.calls[0][0] as Record<string, unknown>;
    expect(waPayload).toMatchObject({
      to: '+250780000000',
      type: 'interactive',
    });
  });
});
