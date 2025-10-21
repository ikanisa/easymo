import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const { intent_id } = await req.json();
    console.log(JSON.stringify({ evt: "insurance.notify_backoffice", reqId, intent_id }));
    return NextResponse.json({ handed_off: true, intent_id, reqId }, { status: 202 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "insurance.notify_backoffice.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

