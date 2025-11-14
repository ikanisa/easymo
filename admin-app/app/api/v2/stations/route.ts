import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { coerceNullableString, handleRouteError } from "../_lib/utils";
import {
  sanitizeStation,
  stationCreateSchema,
  stationSelect,
  type StationRow,
} from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("stations")
      .select(stationSelect)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const stations = (data ?? []) as StationRow[];
    return NextResponse.json(stations.map(sanitizeStation));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = stationCreateSchema.parse(await request.json());
    const supabase = await createAdminClient();

    const insertPayload = {
      id: payload.id,
      name: payload.name.trim(),
      location: coerceNullableString(payload.location),
    };

    const { data, error } = await supabase
      .from("stations")
      .insert(insertPayload)
      .select(stationSelect)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json(sanitizeStation(data as StationRow), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
