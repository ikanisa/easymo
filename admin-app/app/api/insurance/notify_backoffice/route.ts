import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { intent_id } = await req.json();
  // TODO: create ticket/email/slack message to back-office system
  return NextResponse.json({ handed_off: true, intent_id, reqId }, { status: 202 });
}

