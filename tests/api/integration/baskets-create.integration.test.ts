import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseStub = {
  rpc: vi.fn(),
  from: vi.fn(),
};

const insertSpy = vi.fn();

vi.mock('../../../app/api/_lib/supabase-admin', () => ({
  getServiceSupabaseClient: () => supabaseStub,
}));

const featureFlagSpy = vi.fn();
vi.mock('../../../app/api/_lib/feature-flags', () => ({
  getFeatureFlag: featureFlagSpy,
}));

const sendMessageSpy = vi.fn();
vi.mock('../../../app/api/wa/send/service', () => ({
  sendWhatsAppMessage: sendMessageSpy,
}));

async function callRoute(body: unknown) {
  const { POST } = await import('../../../app/api/baskets/create/route');
  const request = new Request('http://localhost/api/baskets/create', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  return POST(request);
}

beforeEach(() => {
  supabaseStub.rpc.mockReset();
  supabaseStub.from.mockReset();
  insertSpy.mockReset();
  featureFlagSpy.mockResolvedValue(true);
  sendMessageSpy.mockReset();
  sendMessageSpy.mockResolvedValue({ ok: true, status: 200 });
  insertSpy.mockResolvedValue({ error: null });
  supabaseStub.from.mockReturnValue({ insert: insertSpy });
  process.env.BASKET_DEEPLINK_BASE_URL = 'https://invite.easymo.link';
  process.env.SUPABASE_URL = 'https://demo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'role';
});

afterEach(() => {
  vi.resetModules();
  delete process.env.BASKET_DEEPLINK_BASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('baskets.create integration', () => {
  it('persists basket invite token and sends confirmation when enabled', async () => {
    supabaseStub.rpc.mockResolvedValueOnce({ data: [{ basket_id: 'basket_1' }], error: null });
    insertSpy.mockResolvedValueOnce({ error: null });

    const response = await callRoute({
      profileId: '00000000-0000-4000-8000-000000000000',
      creatorUserId: '00000000-0000-4000-8000-000000000001',
      creatorMsisdn: '+250700000000',
      name: 'Ibimina',
      isPublic: true,
      goalMinor: 1500,
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({ basketId: 'basket_1', inviteToken: expect.any(String) });
    expect(payload.deeplink).toMatch(/^https:\/\/invite\.easymo\.link/);

    expect(supabaseStub.rpc).toHaveBeenCalledWith('basket_create', expect.objectContaining({
      _profile_id: '00000000-0000-4000-8000-000000000000',
      _name: 'Ibimina',
    }));
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      basket_id: 'basket_1',
      created_by: '00000000-0000-4000-8000-000000000001',
    }));
    expect(sendMessageSpy).toHaveBeenCalled();
  });

  it('propagates RPC failures as 500 responses', async () => {
    supabaseStub.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const response = await callRoute({
      profileId: '00000000-0000-4000-8000-000000000000',
      creatorUserId: '00000000-0000-4000-8000-000000000001',
      creatorMsisdn: '+250700000000',
      name: 'Ibimina',
      isPublic: true,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'basket_create_failed' });
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
