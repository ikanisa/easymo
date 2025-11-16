import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { coerceNullableString, handleRouteError } from "../_lib/utils";
import {
  driverCreateSchema,
  driverSelect,
  sanitizeDriver,
  type DriverRow,
} from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("drivers")
      .select(driverSelect)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const drivers = (data ?? []) as DriverRow[];
    return NextResponse.json(drivers.map(sanitizeDriver));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = driverCreateSchema.parse(await request.json());
    const supabase = await createAdminClient();

    const insertPayload = {
      id: payload.id,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      status: coerceNullableString(payload.status),
      vehicle_id: payload.vehicle_id ?? null,
    };

    const { data, error } = await supabase
      .from("drivers")
      .insert(insertPayload)
      .select(driverSelect)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json(sanitizeDriver(data as DriverRow), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
