import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const response = NextResponse.json(session);
  response.headers.set("cache-control", "no-store");
  return response;
}
