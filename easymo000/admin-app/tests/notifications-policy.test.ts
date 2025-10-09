import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

const originalEnv = { ...process.env };

describe('enqueueNotification', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('inserts notification and records audit entry', async () => {
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin') as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const single = vi.fn().mockResolvedValue({ data: { id: 'notif-1' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { enqueueNotification } = await import('@/lib/server/notifications');
    await expect(
      enqueueNotification({ template: 'voucher', toRole: 'ops', msisdn: '+250700000001' })
    ).resolves.toBe('notif-1');

    expect(insert).toHaveBeenCalledWith({
      type: 'voucher',
      to_role: 'ops',
      msisdn: '+250700000001',
      status: 'queued',
      metadata: {},
      payload: {},
    });
    const { recordAudit } = await import('@/lib/server/audit');
    expect(recordAudit).toHaveBeenCalledWith({
      actorId: null,
      action: 'notification_enqueue',
      targetTable: 'notifications',
      targetId: 'notif-1',
      diff: {
        template: 'voucher',
        toRole: 'ops',
        msisdn: '+250700000001',
      },
    });
  });

  it('propagates actor id into audit trail', async () => {
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin') as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const single = vi.fn().mockResolvedValue({ data: { id: 'notif-2' }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { enqueueNotification } = await import('@/lib/server/notifications');
    await enqueueNotification({
      template: 'voucher',
      toRole: 'ops',
      msisdn: '+250700000002',
      actorId: '00000000-0000-0000-0000-000000000123',
    });

    const { recordAudit } = await import('@/lib/server/audit');
    expect(recordAudit).toHaveBeenLastCalledWith({
      actorId: '00000000-0000-0000-0000-000000000123',
      action: 'notification_enqueue',
      targetTable: 'notifications',
      targetId: 'notif-2',
      diff: {
        template: 'voucher',
        toRole: 'ops',
        msisdn: '+250700000002',
      },
    });
  });

  it('throws when Supabase client unavailable', async () => {
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin') as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue(null);

    const { enqueueNotification } = await import('@/lib/server/notifications');
    await expect(enqueueNotification({ template: 'voucher', toRole: 'ops', msisdn: '+250700000001' })).rejects.toThrow('supabase_unavailable');
  });
});
