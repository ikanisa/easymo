export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

import { createHandler } from "@/app/api/withObservability";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { logStructured } from "@/lib/server/logger";

export const POST = createHandler("admin_auth.logout", async () => {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("admin_actor_id", "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  logStructured({ event: "admin_auth.logout", status: "ok" });

  return response;
});

export const runtime = "nodejs";
