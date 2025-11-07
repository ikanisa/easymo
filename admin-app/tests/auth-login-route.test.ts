import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest } from './utils/api';

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

const originalEnv = { ...process.env };

describe('admin auth login route', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('returns 503 when credentials are not configured', async () => {
    process.env.ADMIN_SESSION_SECRET = 'integration-test-secret';
    process.env.ADMIN_ACCESS_CREDENTIALS = '';

    const { POST } = await import('@/app/api/auth/login/route');
    const request = createAdminApiRequest(['auth', 'login'], {
      method: 'POST',
      body: JSON.stringify({ email: 'info@ikanisa.com', password: 'test-password' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it('rejects invalid email/password combinations', async () => {
    process.env.ADMIN_SESSION_SECRET = 'integration-test-secret';
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      {
        actorId: '00000000-0000-0000-0000-000000000001',
        email: 'info@ikanisa.com',
        password: 'MoMo!!0099',
        username: 'Admin',
      },
    ]);

    const { POST } = await import('@/app/api/auth/login/route');
    const request = createAdminApiRequest(['auth', 'login'], {
      method: 'POST',
      body: JSON.stringify({ email: 'info@ikanisa.com', password: 'wrong-pass' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('issues a session cookie on success with email/password', async () => {
    process.env.ADMIN_SESSION_SECRET = 'integration-test-secret';
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      {
        actorId: '00000000-0000-0000-0000-000000000001',
        email: 'info@ikanisa.com',
        password: 'MoMo!!0099',
        username: 'Admin',
      },
    ]);

    const { POST } = await import('@/app/api/auth/login/route');
    const request = createAdminApiRequest(['auth', 'login'], {
      method: 'POST',
      body: JSON.stringify({ email: 'info@ikanisa.com', password: 'MoMo!!0099' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('admin_session=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('supports legacy token logins for backward compatibility', async () => {
    process.env.ADMIN_SESSION_SECRET = 'integration-test-secret';
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      { actorId: '00000000-0000-0000-0000-000000000002', token: 'legacy-token', label: 'Ops' },
    ]);

    const { POST } = await import('@/app/api/auth/login/route');
    const request = createAdminApiRequest(['auth', 'login'], {
      method: 'POST',
      body: JSON.stringify({ token: 'legacy-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('rate limits repeated failed attempts', async () => {
    process.env.ADMIN_SESSION_SECRET = 'integration-test-secret';
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      {
        actorId: '00000000-0000-0000-0000-000000000001',
        email: 'info@ikanisa.com',
        password: 'MoMo!!0099',
      },
    ]);
    process.env.ADMIN_LOGIN_MAX_ATTEMPTS = '3';
    process.env.ADMIN_LOGIN_WINDOW_MS = '1000';

    const { POST } = await import('@/app/api/auth/login/route');
    const requestFactory = () =>
      createAdminApiRequest(['auth', 'login'], {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
        body: JSON.stringify({ email: 'info@ikanisa.com', password: 'wrong-password' }),
      });

    for (let index = 0; index < 3; index += 1) {
      const res = await POST(requestFactory());
      expect(res.status).toBe(401);
    }

    const limitedResponse = await POST(requestFactory());
    expect(limitedResponse.status).toBe(429);
  });
});
