import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSecurityMiddlewareContext } from "@ibimina/lib";

export function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const defaultLocale = process.env.NEXT_PUBLIC_LOCALE ?? undefined;
  const security = createSecurityMiddlewareContext({
    requestHeaders: request.headers,
    defaultLocale,
    isDev: process.env.NODE_ENV !== "production",
    supabaseUrl,
  });

  const response = NextResponse.next({
    request: {
      headers: security.requestHeaders,
    },
  });

  security.applyResponseHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
