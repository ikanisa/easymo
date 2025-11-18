import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSessionCookie, SESSION_COOKIE_NAME } from './lib/server/session';

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

function isPublicPath(pathname: string) {
  if (pathname === '/login') return true;
  // Allow common static assets
  if (pathname.startsWith('/favicon') || pathname.endsWith('.svg') || pathname.endsWith('.ico') || pathname.endsWith('.png')) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', buildRequestId());
  }

  const { pathname } = new URL(request.url);
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // Validate session cookie for protected paths
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader
    .split(/;\s*/)
    .map((entry) => entry.split('=' as const))
    .find(([name]) => name === SESSION_COOKIE_NAME);
  const sessionValue = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : undefined;
  const session = parseSessionCookie(sessionValue);

  if (!session) {
    const response = new NextResponse('Unauthorized', { status: 401, headers });
    // Clear session cookie proactively
    response.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
    return response;
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt).*)'],
};
