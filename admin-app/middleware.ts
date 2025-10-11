import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEV_FALLBACK_ACTOR = process.env.ADMIN_DEFAULT_ACTOR_ID
  ?? process.env.NEXT_PUBLIC_DEFAULT_ACTOR_ID
  ?? null;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  if (!headers.get('x-request-id')) {
    try {
      // Edge runtime has Web Crypto API
      const rid = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      headers.set('x-request-id', rid);
    } catch {
      headers.set('x-request-id', `${Date.now()}-${Math.random()}`);
    }
  }

  let actorId = request.headers.get('x-actor-id')
    ?? request.cookies.get('admin_actor_id')?.value
    ?? ((process.env.NODE_ENV !== 'production') ? DEV_FALLBACK_ACTOR : null);

  if (!actorId) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: 'Missing x-actor-id header. Provide a valid admin actor identifier.',
      },
      { status: 401 },
    );
  }

  if (!UUID_REGEX.test(actorId)) {
    return NextResponse.json(
      {
        error: 'invalid_actor_id',
        message: 'Actor identifier must be a UUID.',
      },
      { status: 400 },
    );
  }

  headers.set('x-actor-id', actorId);

  const response = NextResponse.next({ request: { headers } });

  if (!request.cookies.get('admin_actor_id')) {
    response.cookies.set('admin_actor_id', actorId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
