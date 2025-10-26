import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest, getAdminApiUrl } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/policy', () => ({
  evaluateOutboundPolicy: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

const headersGetMock = vi.fn((_key: string) => null);
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: headersGetMock,
  })),
}));

const originalEnv = { ...process.env };

const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
const { evaluateOutboundPolicy } = await import('@/lib/server/policy');
const { recordAudit } = await import('@/lib/server/audit');

function createOrdersBuilder(data: unknown[]) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data, error: null, count: data.length })),
  };
  return builder;
}

function createOrderEventsBuilder(data: unknown[]) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };
  return builder;
}

function createNotificationSelection(data: unknown[]) {
  return {
    select: vi.fn(() => ({
      in: vi.fn(() => Promise.resolve({ data, error: null })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  };
}

function createOcrJobsBuilder(data: unknown[], count: number = data.length) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data, error: null, count })),
  };
  return builder;
}

describe('admin journeys', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    headersGetMock.mockImplementation((_key: string) => null);
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('lists orders and related events for a customer flow', async () => {
    const orders = [
      {
        id: 'order-1',
        bar_id: 'bar-1',
        bar_name: 'Downtown Bar',
        table_label: 'T3',
        status: 'pending',
        total: 23000,
        created_at: '2025-10-01T12:00:00Z',
        updated_at: '2025-10-01T12:10:00Z',
        staff_number: '+250780000100',
      },
    ];

    const events = [
      {
        id: 'evt-1',
        order_id: 'order-1',
        type: 'created',
        status: 'pending',
        actor_id: 'customer-1',
        note: 'Order created via WhatsApp',
        created_at: '2025-10-01T12:00:02Z',
      },
      {
        id: 'evt-2',
        order_id: 'order-1',
        type: 'vendor_nudge',
        status: null,
        actor_id: 'system',
        note: 'Pending reminder queued for vendor',
        created_at: '2025-10-01T12:15:00Z',
      },
    ];

    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'orders') return createOrdersBuilder(orders);
        if (table === 'order_events') return createOrderEventsBuilder(events);
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { GET: listOrders } = await import('@/app/api/orders/route');
    const ordersResponse = await listOrders(createAdminApiRequest(['orders']));
    expect(ordersResponse.status).toBe(200);
    const ordersPayload = await ordersResponse.json();
    expect(ordersPayload.data).toHaveLength(1);
    expect(ordersPayload.data[0].barName).toBe('Downtown Bar');
    expect(ordersPayload.data[0].status).toBe('pending');

    const { GET: listEvents } = await import('@/app/api/orders/events/route');
    const eventsResponse = await listEvents(createAdminApiRequest(['orders', 'events']));
    expect(eventsResponse.status).toBe(200);
    const eventsPayload = await eventsResponse.json();
    expect(eventsPayload.data).toHaveLength(2);
    expect(eventsPayload.data.find((event: any) => event.type === 'vendor_nudge')).toBeDefined();
  });

  it('requeues failed notifications via retry API', async () => {
    const notificationId = '2b9fae9a-2c5c-4e86-9a9b-e90c0dc2f8a1';
    const notification = {
      id: notificationId,
      status: 'failed',
      msisdn: '+250780000111',
      retry_count: 2,
      type: 'order_pending_vendor',
      to_role: 'vendor',
    };

    const notificationsStub = createNotificationSelection([notification]);
    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'notifications') return notificationsStub;
        throw new Error(`Unexpected table ${table}`);
      },
    });
    evaluateOutboundPolicy.mockResolvedValue({ allowed: true });
    headersGetMock.mockImplementation((key: string) =>
      key === 'x-actor-id' ? '00000000-0000-0000-0000-000000000abc' : null,
    );

    const { POST: retryNotifications } = await import('@/app/api/notifications/retry/route');
    const response = await retryNotifications(createAdminApiRequest(['notifications', 'retry'], {
      method: 'POST',
      body: JSON.stringify({ ids: [notificationId] }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queued).toEqual([notificationId]);
    expect(payload.blocked).toHaveLength(0);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_retry', targetId: notificationId }),
    );
  });

  it('surfaces policy blocks when retrying notifications during quiet hours', async () => {
    const notificationId = 'a67375c9-87a0-4104-85c1-74223e6a5886';
    const notification = {
      id: notificationId,
      status: 'failed',
      msisdn: '+250780000112',
      retry_count: 1,
      type: 'cart_reminder_customer',
      to_role: 'customer',
    };

    const notificationsStub = createNotificationSelection([notification]);
    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'notifications') return notificationsStub;
        throw new Error(`Unexpected table ${table}`);
      },
    });
    evaluateOutboundPolicy.mockResolvedValue({
      allowed: false,
      reason: 'quiet_hours',
      message: 'Quiet hours in effect',
      blockedAt: '2025-10-06T12:05:00Z',
    });

    const { POST: retryNotifications } = await import('@/app/api/notifications/retry/route');
    const response = await retryNotifications(createAdminApiRequest(['notifications', 'retry'], {
      method: 'POST',
      body: JSON.stringify({ ids: [notificationId] }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queued).toHaveLength(0);
    expect(payload.blocked[0]).toMatchObject({ id: notificationId, reason: 'quiet_hours', blockedAt: '2025-10-06T12:05:00Z' });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_retry_blocked', targetId: notificationId }),
    );
  });

  it('lists OCR jobs for admin review', async () => {
    const jobs = [
      {
        id: 'ocr-job-1',
        bar_id: 'bar-ocr-1',
        bars: { name: 'OCR Test Bar' },
        source_file_id: 'menu.pdf',
        status: 'processing',
        error_message: null,
        attempts: 1,
        created_at: '2025-10-03T08:00:00Z',
        updated_at: '2025-10-03T08:05:00Z',
      },
      {
        id: 'ocr-job-2',
        bar_id: 'bar-ocr-2',
        bars: { name: 'Downtown Cafe' },
        source_file_id: 'draft.png',
        status: 'queued',
        error_message: null,
        attempts: 0,
        created_at: '2025-10-02T11:20:00Z',
        updated_at: '2025-10-02T11:21:00Z',
      },
    ];

    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'ocr_jobs') return createOcrJobsBuilder(jobs);
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { GET: listOcrJobs } = await import('@/app/api/ocr/jobs/route');
    const response = await listOcrJobs(new Request(getAdminApiUrl(['ocr', 'jobs'], 'status=processing')));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(2);
    const processing = payload.data.find((job: any) => job.id === 'ocr-job-1');
    expect(processing.status).toBe('processing');
    expect(processing.barName).toBe('OCR Test Bar');
    expect(payload.total).toBe(2);
  });
});
