import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { intent_id } = await req.json();
  // TODO: create ticket/email/slack message to back-office system
  return NextResponse.json({ handed_off: true, intent_id, reqId }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "insurance.notify_backoffice", status: "ok", reqId }, { status: 200 });
}
