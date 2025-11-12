import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '../middleware';
import { createSessionCookie } from '../lib/server/session';

function buildRequest(path: string, init?: { cookie?: string; headers?: Record<string, string> }) {
  const url = new URL(`https://example.com${path}`);
  const headers = new Headers(init?.headers);

  if (init?.cookie) {
    headers.set('cookie', init.cookie);
  }

  return new NextRequest(url, { headers });
}

describe('middleware authentication', () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeAll(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret-123456789';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it('allows public routes without a session', async () => {
    const request = buildRequest('/login');
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it('allows static asset requests without a session', async () => {
    const request = buildRequest('/logo.svg');
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it('blocks protected routes without a session', async () => {
    const request = buildRequest('/dashboard');
    const response = await middleware(request);

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.cookies.get('admin_session')?.value).toBe('');
  });

  it('allows protected routes when session cookie is valid', async () => {
    const sessionCookie = createSessionCookie({ actorId: 'actor-123', label: 'Admin' });
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;

    const request = buildRequest('/dashboard', { cookie: cookieHeader });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});
