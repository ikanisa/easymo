import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { Database } from "@/src/v2/lib/supabase/database.types";

import { clearSessionCookie, isAdminSupabaseUser, readSessionFromCookies } from './lib/server/session';
import { childLogger } from './lib/server/simple-logger';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/favicon',
  '/manifest.webmanifest',
  '/manifest.json',
  '/robots.txt',
  '/sw.js',
];

const MUTATION_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// API routes that should be exempt from CSRF (they have their own auth)
const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/callback',
];

function buildRequestId(): string {
  try {
    const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPublicPath(pathname: string): boolean {
  // Root path should be exact match only
  if (pathname === '/') return true;
  
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) return true;
  
  // Match with trailing slash for directory paths
  if (PUBLIC_PATHS.some((p) => {
    if (p === '/') return false;
    return pathname === p || pathname.startsWith(p + '/');
  })) return true;
  
  // File extensions
  if (pathname.endsWith('.svg') || pathname.endsWith('.ico') || pathname.endsWith('.png')) return true;
  if (pathname.startsWith('/_next/')) return true;
  
  return false;
}

function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function validateCsrfToken(request: NextRequest): boolean {
  // Get the origin and referer headers
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // For same-origin requests, either origin or referer should match the host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        return true;
      }
    } catch {
      // Invalid origin URL
    }
  }
  
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) {
        return true;
      }
    } catch {
      // Invalid referer URL
    }
  }

  // Also check for X-Requested-With header (common for AJAX requests)
  const xRequestedWith = request.headers.get('x-requested-with');
  if (xRequestedWith === 'XMLHttpRequest') {
    return true;
  }
  
  // Check for custom CSRF header (can be set by client applications)
  // NOTE: Currently only checks for header presence. For enhanced security,
  // implement a token verification system that:
  // 1. Generates unique tokens per session and stores them server-side
  // 2. Validates the token value matches the stored session token
  // This origin/referer validation provides baseline CSRF protection for
  // same-origin requests, which is sufficient for most use cases.
  const csrfHeader = request.headers.get('x-csrf-token');
  if (csrfHeader) {
    return true;
  }

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
  const pathname = request.nextUrl.pathname;

  if (request.method === 'OPTIONS' || isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // CSRF validation for mutation requests on protected API routes
  if (MUTATION_METHODS.includes(request.method) && 
      pathname.startsWith('/api/') && 
      !isCsrfExemptPath(pathname)) {
    if (!validateCsrfToken(request)) {
      log.warn({ event: 'CSRF_VALIDATION_FAILED', method: request.method, path: pathname }, 'CSRF token validation failed');
      return NextResponse.json({ error: 'CSRF validation failed' }, {
        status: 403,
        headers: { 'x-request-id': requestId },
      });
    }
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
