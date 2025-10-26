import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest, getAdminApiUrl } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('@/lib/server/policy', () => ({
  evaluateOutboundPolicy: vi.fn(),
}));

vi.mock('@/lib/server/edge-bridges', () => ({
  callBridge: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

const headersGetMock = vi.fn((_key: string) => null);
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: headersGetMock,
  })),
}));

const originalEnv = { ...process.env };

describe('notifications API', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    headersGetMock.mockImplementation((_key: string) => null);
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
    headersGetMock.mockReset();
  });

  it('returns 503 when Supabase credentials missing', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue(null);

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(createAdminApiRequest(['notifications']), {} as unknown as { params: Record<string, never> });
    expect(response.status).toBe(503);
  });

  it('returns notifications when Supabase query succeeds', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const queryResult = {
      data: [{
        id: 'notif-1',
        to_role: 'ops',
        type: 'voucher',
        status: 'queued',
        created_at: '2025-10-06T12:00:00Z',
        sent_at: null,
      }],
      error: null,
      count: 1,
    };

    const builder: any = {
      select: vi.fn(function () { return builder; }),
      order: vi.fn(function () { return builder; }),
      range: vi.fn(function () { return builder; }),
      eq: vi.fn(function () { return builder; }),
      then: (resolve: (value: typeof queryResult) => void) => Promise.resolve(resolve(queryResult)),
    };

    const from = vi.fn(() => builder);
    getSupabaseAdminClient.mockReturnValue({ from });

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(createAdminApiRequest(['notifications']), {} as unknown as { params: Record<string, never> });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.total).toBe(1);
  });

  it('queues resend when policy allows', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { evaluateOutboundPolicy } = (await import('@/lib/server/policy')) as {
      evaluateOutboundPolicy: ReturnType<typeof vi.fn>;
    };
    const { callBridge } = (await import('@/lib/server/edge-bridges')) as {
      callBridge: ReturnType<typeof vi.fn>;
    };
    const { recordAudit } = (await import('@/lib/server/audit')) as {
      recordAudit: ReturnType<typeof vi.fn>;
    };

    evaluateOutboundPolicy.mockResolvedValue({ allowed: true });
    callBridge.mockResolvedValue({ ok: true });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '4c3f4b21-7b98-4a52-8c3f-9937b4c1f111',
        msisdn: '+250780000001',
        status: 'failed',
        retry_count: 2,
        type: 'order_pending_vendor',
        to_role: 'vendor',
      },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    headersGetMock.mockImplementation((key: string) =>
      key === 'x-actor-id' ? '00000000-0000-0000-0000-000000000000' : null
    );

    const { POST } = await import('@/app/api/notifications/[id]/route');
    const request = createAdminApiRequest(['notifications', '4c3f4b21-7b98-4a52-8c3f-9937b4c1f111'], {
      method: 'POST',
      body: JSON.stringify({ action: 'resend' }),
    });

    const response = await POST(request, {
      params: { id: '4c3f4b21-7b98-4a52-8c3f-9937b4c1f111' },
    });

    expect(response.status).toBe(200);
    expect(callBridge).toHaveBeenCalledWith(
      'voucherSend',
      expect.objectContaining({ notificationId: '4c3f4b21-7b98-4a52-8c3f-9937b4c1f111' })
    );
    expect(update).toHaveBeenCalledWith({
      status: 'queued',
      sent_at: null,
      error_message: null,
      retry_count: 0,
      next_attempt_at: null,
      locked_at: null,
    });
    expect(updateEq).toHaveBeenCalledWith(
      'id',
      '4c3f4b21-7b98-4a52-8c3f-9937b4c1f111'
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_resend' })
    );
  });

  it('returns policy block when quiet hours active', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { evaluateOutboundPolicy } = (await import('@/lib/server/policy')) as {
      evaluateOutboundPolicy: ReturnType<typeof vi.fn>;
    };
    const { callBridge } = (await import('@/lib/server/edge-bridges')) as {
      callBridge: ReturnType<typeof vi.fn>;
    };
    const { recordAudit } = (await import('@/lib/server/audit')) as {
      recordAudit: ReturnType<typeof vi.fn>;
    };

    evaluateOutboundPolicy.mockResolvedValue({
      allowed: false,
      reason: 'quiet_hours',
      message: 'Quiet hours in effect',
      blockedAt: '2025-10-06T12:05:00Z',
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'd40e28fb-b185-4d70-9f0c-74dbb83b5f5e',
        msisdn: '+250780000001',
        status: 'failed',
        retry_count: 1,
        type: 'order_pending_vendor',
        to_role: 'vendor',
      },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/notifications/[id]/route');
    const request = createAdminApiRequest(['notifications', 'd40e28fb-b185-4d70-9f0c-74dbb83b5f5e'], {
      method: 'POST',
      body: JSON.stringify({ action: 'resend' }),
    });

    const response = await POST(request, {
      params: { id: 'd40e28fb-b185-4d70-9f0c-74dbb83b5f5e' },
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.reason).toBe('quiet_hours');
    expect(payload.blockedAt).toEqual(expect.any(String));
    expect(callBridge).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound_policy_check' })
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({ blockedAt: expect.any(String) })
      })
    );
  });

  it('returns throttle metadata when policy throttles resend', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { evaluateOutboundPolicy } = (await import('@/lib/server/policy')) as {
      evaluateOutboundPolicy: ReturnType<typeof vi.fn>;
    };
    const { callBridge } = (await import('@/lib/server/edge-bridges')) as {
      callBridge: ReturnType<typeof vi.fn>;
    };

    evaluateOutboundPolicy.mockResolvedValue({
      allowed: false,
      reason: 'throttled',
      message: 'Per-minute WhatsApp throttle reached.',
      blockedAt: '2025-10-06T12:06:00Z',
      throttle: {
        count: 60,
        limit: 60,
        windowStart: '2025-10-06T12:06:00Z',
        windowEnd: '2025-10-06T12:07:00Z',
      },
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'dd0b4a7a-6ae0-4800-9e3e-3b3b5c3c4d4e',
        msisdn: '+250780000003',
        status: 'failed',
        retry_count: 1,
        type: 'order_pending_vendor',
        to_role: 'vendor',
      },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/notifications/[id]/route');
    const request = createAdminApiRequest(['notifications', 'dd0b4a7a-6ae0-4800-9e3e-3b3b5c3c4d4e'], {
      method: 'POST',
      body: JSON.stringify({ action: 'resend' }),
    });

    const response = await POST(request, {
      params: { id: 'dd0b4a7a-6ae0-4800-9e3e-3b3b5c3c4d4e' },
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.reason).toBe('throttled');
    expect(payload.blockedAt).toBe('2025-10-06T12:06:00Z');
    expect(payload.throttle).toEqual({
      count: 60,
      limit: 60,
      windowStart: '2025-10-06T12:06:00Z',
      windowEnd: '2025-10-06T12:07:00Z',
    });
    expect(callBridge).not.toHaveBeenCalled();
  });

  it('cancels queued notification', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { recordAudit } = (await import('@/lib/server/audit')) as {
      recordAudit: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '5e4674f4-6de6-49a6-9ac4-58a3c3d1c111',
        msisdn: '+250780000005',
        status: 'queued',
        retry_count: 0,
        type: 'voucher_issue_client',
        to_role: 'customer',
      },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/notifications/[id]/route');
    const request = createAdminApiRequest(['notifications', '5e4674f4-6de6-49a6-9ac4-58a3c3d1c111'], {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel' }),
    });

    const response = await POST(request, {
      params: { id: '5e4674f4-6de6-49a6-9ac4-58a3c3d1c111' },
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: 'cancelled', locked_at: null, next_attempt_at: null });
    expect(updateEq).toHaveBeenCalledWith('id', '5e4674f4-6de6-49a6-9ac4-58a3c3d1c111');
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_cancel' })
    );
  });

  it('returns 422 when msisdn missing on resend', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '8e5fd38d-3d40-4b53-8c43-d4b895d0cb31',
        msisdn: null,
        status: 'failed',
        retry_count: 1,
        type: 'order_pending_vendor',
        to_role: 'vendor',
      },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/notifications/[id]/route');
    const request = createAdminApiRequest(['notifications', '8e5fd38d-3d40-4b53-8c43-d4b895d0cb31'], {
      method: 'POST',
      body: JSON.stringify({ action: 'resend' }),
    });

    const response = await POST(request, {
      params: { id: '8e5fd38d-3d40-4b53-8c43-d4b895d0cb31' },
    });

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.error).toBe('missing_recipient');
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 503 when retry Supabase client unavailable', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue(null);

    const { POST } = await import('@/app/api/notifications/retry/route');
    const request = createAdminApiRequest(['notifications', 'retry'], {
      method: 'POST',
      body: JSON.stringify({ ids: ['089b2468-3e5e-4037-93dc-5fca4c9de121'] }),
    });

    const response = await POST(request, {} as unknown as { params: Record<string, never> });
    expect(response.status).toBe(503);
  });

  it('queues retry for failed notification', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { evaluateOutboundPolicy } = (await import('@/lib/server/policy')) as {
      evaluateOutboundPolicy: ReturnType<typeof vi.fn>;
    };
    const { recordAudit } = (await import('@/lib/server/audit')) as {
      recordAudit: ReturnType<typeof vi.fn>;
    };

    evaluateOutboundPolicy.mockResolvedValue({ allowed: true });

    const inFn = vi.fn().mockResolvedValue({
      data: [{
        id: '2b9fae9a-2c5c-4e86-9a9b-e90c0dc2f8a1',
        status: 'failed',
        msisdn: '+250780000001',
        retry_count: 1,
        type: 'order_pending_vendor',
        to_role: 'vendor',
      }],
      error: null,
    });
    const select = vi.fn(() => ({ in: inFn }));
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    headersGetMock.mockImplementation((key: string) =>
      key === 'x-actor-id' ? '00000000-0000-0000-0000-000000000444' : null
    );

    const { POST } = await import('@/app/api/notifications/retry/route');
    const request = createAdminApiRequest(['notifications', 'retry'], {
      method: 'POST',
      body: JSON.stringify({ ids: ['2b9fae9a-2c5c-4e86-9a9b-e90c0dc2f8a1'] }),
    });

    const response = await POST(request, {} as unknown as { params: Record<string, never> });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queued).toEqual(['2b9fae9a-2c5c-4e86-9a9b-e90c0dc2f8a1']);
    expect(eq).toHaveBeenCalledWith('id', '2b9fae9a-2c5c-4e86-9a9b-e90c0dc2f8a1');
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_retry' })
    );
  });

  it('blocks retry when policy disallows', async () => {
    const {
      getSupabaseAdminClient,
    } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const { evaluateOutboundPolicy } = (await import('@/lib/server/policy')) as {
      evaluateOutboundPolicy: ReturnType<typeof vi.fn>;
    };
    const { recordAudit } = (await import('@/lib/server/audit')) as {
      recordAudit: ReturnType<typeof vi.fn>;
    };

    evaluateOutboundPolicy.mockResolvedValue({
      allowed: false,
      reason: 'quiet_hours',
      message: 'Quiet hours in effect',
      blockedAt: '2025-10-06T12:05:00Z',
    });

    const inFn = vi.fn().mockResolvedValue({
      data: [{
        id: 'a67375c9-87a0-4104-85c1-74223e6a5886',
        status: 'failed',
        msisdn: '+250780000002',
        retry_count: 3,
        type: 'cart_reminder_customer',
        to_role: 'customer',
      }],
      error: null,
    });
    const select = vi.fn(() => ({ in: inFn }));
    const update = vi.fn();
    const from = vi.fn(() => ({ select, update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/notifications/retry/route');
    const request = createAdminApiRequest(['notifications', 'retry'], {
      method: 'POST',
      body: JSON.stringify({ ids: ['a67375c9-87a0-4104-85c1-74223e6a5886'] }),
    });

    const response = await POST(request, {} as unknown as { params: Record<string, never> });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queued).toEqual([]);
    expect(payload.blocked[0].reason).toBe('quiet_hours');
    expect(payload.blocked[0].blockedAt).toEqual('2025-10-06T12:05:00Z');
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_retry_blocked' })
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({ blockedAt: '2025-10-06T12:05:00Z' })
      })
    );
  });
});
