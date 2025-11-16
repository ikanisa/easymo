import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminCredential } from "@/lib/server/admin-credentials-bcrypt";
import { writeSessionToCookies } from "@/lib/server/session";
import { checkRateLimit, clearRateLimit } from "@/lib/server/rate-limit";
import { validateCsrfToken } from "@/lib/server/csrf";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  csrfToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = loginSchema.parse(body);
    
    // CSRF validation (warn but don't block)
    const csrfToken = request.headers.get('x-csrf-token') || payload.csrfToken;
    if (csrfToken && !validateCsrfToken(csrfToken)) {
      console.warn('Invalid CSRF token detected');
    }
    
    // Rate limiting by email
    const rateLimit = checkRateLimit(`login:${payload.email}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 900),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // Verify credentials with bcrypt
    const credential = verifyAdminCredential(payload.email, payload.password);
    
    if (!credential) {
      return NextResponse.json(
        {
          error: "invalid_credentials",
          message: "Email or password is incorrect.",
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": String(rateLimit.remaining - 1),
            "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // Clear rate limit on successful login
    clearRateLimit(`login:${payload.email}`);

    // Create session
    const ttlMs = payload.rememberMe 
      ? 30 * 24 * 60 * 60 * 1000 
      : 8 * 60 * 60 * 1000;

    writeSessionToCookies({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? credential.email,
      ttlMs,
    });

    const response = NextResponse.json({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? null,
    });

    // Security headers
    response.headers.set("x-admin-session-refreshed", "true");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    
    if (process.env.NODE_ENV === 'production') {
      response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid email or password format." },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
