import { NextRequest, NextResponse } from "next/server";

const STUB_COOKIE_NAME = "stub-auth";

function disabled() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

type SessionState = "authenticated" | "anonymous";

function createResponse(state: SessionState) {
  const response = NextResponse.json({ state });
  if (state === "authenticated") {
    response.cookies.set({
      name: STUB_COOKIE_NAME,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60,
    });
  } else {
    response.cookies.set({
      name: STUB_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (process.env.AUTH_E2E_STUB !== "1") {
    return disabled();
  }

  let state: SessionState = "anonymous";
  try {
    const body = await request.json();
    if (body && typeof body.state === "string" && body.state === "authenticated") {
      state = "authenticated";
    }
  } catch {
    state = "anonymous";
  }

  return createResponse(state);
}

export async function DELETE() {
  if (process.env.AUTH_E2E_STUB !== "1") {
    return disabled();
  }

  return createResponse("anonymous");
}
