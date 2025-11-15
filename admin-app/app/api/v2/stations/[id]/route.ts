import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { coerceNullableString, handleRouteError } from "../../_lib/utils";
import { sanitizeStation, stationSelect, stationUpdateSchema, type StationRow } from "../schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const updates = stationUpdateSchema.parse(await request.json());

    const updatePayload: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(updates, "name") && updates.name !== undefined) {
      updatePayload.name = updates.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(updates, "location")) {
      updatePayload.location = coerceNullableString(updates.location ?? null);
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("stations")
      .update(updatePayload)
      .eq("id", id)
      .select(stationSelect)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(sanitizeStation(data as StationRow));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("stations")
      .delete()
      .eq("id", id)
      .select(stationSelect)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(sanitizeStation(data as StationRow));
  } catch (error) {
    return handleRouteError(error);
  }
}
