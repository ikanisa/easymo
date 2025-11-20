import { createServerClient } from "@supabase/ssr";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from "@/src/v2/lib/supabase/database.types";

import { clearSessionCookie, isAdminSupabaseUser, readSessionFromCookies } from './lib/server/session';
import { childLogger } from './lib/server/simple-logger';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/favicon',
  '/manifest.webmanifest',
  '/manifest.json',
  '/robots.txt',
  '/sw.js',
];

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
  // Root path should be exact match only
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.some((p) => p !== '/' && (pathname === p || pathname.startsWith(p)))) return true;
  if (pathname.endsWith('.svg') || pathname.endsWith('.ico') || pathname.endsWith('.png')) return true;
  if (pathname.startsWith('/_next/')) return true;
  return false;
}

function createCustomCookieStore(request: NextRequest) {
  return {
    get: (name: string) => {
      const cookieHeader = request.headers.get('cookie') || '';
      const cookieMatch = cookieHeader
        .split(/;\s*/)
        .map((entry) => entry.split('='))
        .find(([key]) => key === name);
      return cookieMatch ? { value: decodeURIComponent(cookieMatch[1] || '') } : undefined;
    },
  };
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', buildRequestId());
  }

  const requestId = headers.get('x-request-id') || 'unknown';
  const log = childLogger({ service: 'admin-middleware', requestId });

  if (request.method === 'OPTIONS' || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  let response = NextResponse.next({ request: { headers } });

  const legacySession = await readSessionFromCookies(createCustomCookieStore(request));
  if (legacySession) {
    return response;
  }

  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      log.warn({ event: 'AUTH_SESSION_ERROR', error: error.message, path: request.nextUrl.pathname }, 'Supabase session retrieval failed');
    }
    if (data.session && isAdminSupabaseUser(data.session.user)) {
      return response;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warn({ event: 'AUTH_MIDDLEWARE_ERROR', error: errorMessage, path: request.nextUrl.pathname }, 'Authentication middleware error');
  }

  const responseHeaders = new Headers();
  if (requestId) {
    responseHeaders.set('x-request-id', requestId);
  }

  const unauthorized = NextResponse.json({ error: 'Unauthorized' }, {
    status: 401,
    headers: responseHeaders,
  });

  const clearCookie = clearSessionCookie();
  unauthorized.cookies.set(clearCookie.name, clearCookie.value, clearCookie.attributes);

  return unauthorized;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|robots.txt|sw.js).*)'],
};
