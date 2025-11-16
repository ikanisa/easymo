import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { clearSessionCookie, readSessionFromCookies } from './lib/server/session';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.json',
  '/sitemap.xml',
];

const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/_next/', '/public/'];

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

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return true;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function readSessionFromRequestCookies(request: NextRequest) {
  return readSessionFromCookies({
    get: (name: string) => request.cookies.get(name) ?? undefined,
    delete: () => {
      /* noop - deletions are handled on the response */
    },
  });
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', buildRequestId());
  }

  if (request.method === 'OPTIONS' || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  const session = await readSessionFromRequestCookies(request);

  if (!session) {
    const responseHeaders = new Headers();
    const requestId = headers.get('x-request-id');
    if (requestId) {
      responseHeaders.set('x-request-id', requestId);
    }
    const response = NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: responseHeaders,
    });

    const clearCookie = clearSessionCookie();
    response.cookies.set(clearCookie.name, clearCookie.value, clearCookie.attributes);
    return response;
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt).*)'],
};
