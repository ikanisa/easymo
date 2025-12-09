import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const STUB_COOKIE_NAME = "stub-auth";
const SESSION_SCHEMA = z.object({
  state: z.enum(["authenticated", "anonymous"]).default("authenticated"),
});

function e2eEnabled() {
  // Never allow E2E stub in production, regardless of env var
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.AUTH_E2E_STUB === "1";
}

export async function POST(request: NextRequest) {
  if (!e2eEnabled()) {
    return NextResponse.json({ ok: false, error: "e2e_stub_disabled" }, { status: 404 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = SESSION_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_state", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true, state: parsed.data.state }, { status: 200 });
  const cookieStore = await cookies();

  if (parsed.data.state === "authenticated") {
    cookieStore.set(STUB_COOKIE_NAME, "1");
    response.cookies.set({
      name: STUB_COOKIE_NAME,
      value: "1",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60,
    });
  } else {
    cookieStore.delete(STUB_COOKIE_NAME);
    response.cookies.delete(STUB_COOKIE_NAME);
  }

  return response;
}

export async function DELETE() {
  if (!e2eEnabled()) {
    return NextResponse.json({ ok: false, error: "e2e_stub_disabled" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  const cookieStore = await cookies();
  cookieStore.delete(STUB_COOKIE_NAME);
  response.cookies.delete(STUB_COOKIE_NAME);
  return response;
}
