import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { coerceNullableString, handleRouteError, normalizeNumber } from "../_lib/utils";
import {
  agentCreateSchema,
  type AgentRow,
  agentSelect,
  sanitizeAgent,
} from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("agents")
      .select(agentSelect)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const agents = (data ?? []) as AgentRow[];
    return NextResponse.json(agents.map(sanitizeAgent));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = agentCreateSchema.parse(await request.json());
    const supabase = await createAdminClient();

    const insertPayload = {
      id: payload.id,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      status: coerceNullableString(payload.status),
      wallet_balance: normalizeNumber(payload.wallet_balance),
    };

    const { data, error } = await supabase
      .from("agents")
      .insert(insertPayload)
      .select(agentSelect)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json(sanitizeAgent(data as AgentRow), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
