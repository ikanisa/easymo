import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, verifySessionToken, createSessionToken } from '@/lib/auth/session-token';
import { isActorAuthorized } from '@/lib/auth/credentials';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildRequestId(): string {
  try {
    const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  } catch (_error) {
    // fall through
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function resolveActorIdFromSession(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const claims = await verifySessionToken(sessionCookie);
  if (!claims) return null;
  if (!UUID_REGEX.test(claims.sub)) return null;
  if (!isActorAuthorized(claims.sub)) return null;
  return { actorId: claims.sub, expiresAt: claims.exp };
}

function shouldRefresh(expirationSeconds: number): boolean {
  const ttlSeconds = Number.parseInt(process.env.ADMIN_SESSION_TTL_SECONDS ?? '', 10);
  const fallbackTtl = Number.isNaN(ttlSeconds) || ttlSeconds <= 0 ? 60 * 60 * 12 : ttlSeconds;
  const now = Math.floor(Date.now() / 1000);
  const remaining = expirationSeconds - now;
  return remaining > 0 && remaining < Math.max(600, Math.floor(fallbackTtl * 0.2));
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', buildRequestId());
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next({ request: { headers } });
  }

  const session = await resolveActorIdFromSession(request);
  if (!session) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: 'Missing or invalid admin session.',
      },
      { status: 401 },
    );
  }

  headers.set('x-actor-id', session.actorId);

  const response = NextResponse.next({ request: { headers } });

  if (request.cookies.get('admin_actor_id')) {
    response.cookies.set('admin_actor_id', '', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  if (shouldRefresh(session.expiresAt)) {
    try {
      const renewed = await createSessionToken(session.actorId);
      const ttlRaw = process.env.ADMIN_SESSION_TTL_SECONDS;
      const ttlSeconds = Number.parseInt(ttlRaw ?? '', 10);
      const maxAge = Number.isNaN(ttlSeconds) || ttlSeconds <= 0 ? 60 * 60 * 12 : ttlSeconds;
      response.cookies.set(SESSION_COOKIE_NAME, renewed.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge,
        priority: 'high',
      });
    } catch (error) {
      console.error('middleware.session_refresh_failed', error);
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
