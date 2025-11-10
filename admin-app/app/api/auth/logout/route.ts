import { NextResponse } from "next/server";
import { removeSessionFromCookies } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST() {
  removeSessionFromCookies();
  return NextResponse.json({ status: "ok" });
}
