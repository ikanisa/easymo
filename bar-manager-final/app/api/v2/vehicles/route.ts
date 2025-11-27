import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { handleRouteError } from "../_lib/utils";
import { sanitizeVehicle, type VehicleRow,vehicleSelect } from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select(vehicleSelect)
      .order("make", { ascending: true });

    if (error) {
      throw error;
    }

    const vehicles = (data ?? []) as VehicleRow[];
    return NextResponse.json(vehicles.map(sanitizeVehicle));
  } catch (error) {
    return handleRouteError(error);
  }
}
