import { NextRequest, NextResponse } from "next/server";

import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/server/whatsapp";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || reqId;
  
  try {
    const { ride_id, driver_id, passenger_id } = await req.json();
    
    if (!ride_id) {
      return NextResponse.json({ error: "ride_id_required", reqId }, { status: 400 });
    }
    
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
    }

    // Update ride status
    const { error: updateError } = await supabase
      .from("rides")
      .update({ status: "booked", driver_id, updated_at: new Date().toISOString() })
      .eq("id", ride_id);

    if (updateError) {
      logStructured({
        event: "mobility_book_update_failed",
        status: "error",
        correlationId,
        details: { ride_id, error: updateError.message },
      });
      return NextResponse.json({ error: "update_failed", reqId }, { status: 500 });
    }

    // Fetch ride details with passenger and driver info for notifications
    const { data: ride, error: fetchError } = await supabase
      .from("rides")
      .select(`
        id, status, pickup_text, dropoff_text,
        passenger:profiles!rides_passenger_id_fkey(id, whatsapp_e164, ref_code),
        driver:profiles!rides_driver_id_fkey(id, whatsapp_e164, ref_code)
      `)
      .eq("id", ride_id)
      .single();

    if (fetchError || !ride) {
      logStructured({
        event: "mobility_book_fetch_failed",
        status: "warning",
        correlationId,
        details: { ride_id, error: fetchError?.message || "ride_not_found" },
      });
      // Still return success as booking was done, but notifications may fail
    }

    // Notify driver via WhatsApp (if driver info available)
    const driverPhone = ride?.driver?.whatsapp_e164;
    if (driverPhone) {
      try {
        await sendWhatsAppMessage({
          to: driverPhone,
          type: "text",
          text: {
            body: `🚗 New ride booking confirmed!\n\nPickup: ${ride.pickup_text || "Location shared"}\nDropoff: ${ride.dropoff_text || "To be confirmed"}\nPassenger Ref: ${ride.passenger?.ref_code || "N/A"}\n\nPlease contact the passenger to confirm pickup time.`,
          },
          correlationId,
        });
        logStructured({
          event: "mobility_book_driver_notified",
          status: "ok",
          correlationId,
          details: { ride_id, driver_id },
        });
      } catch (notifyError) {
        logStructured({
          event: "mobility_book_driver_notify_failed",
          status: "warning",
          correlationId,
          details: { ride_id, error: notifyError instanceof Error ? notifyError.message : "unknown" },
        });
      }
    }

    // Notify passenger via WhatsApp (if passenger info available)
    const passengerPhone = ride?.passenger?.whatsapp_e164;
    if (passengerPhone) {
      try {
        await sendWhatsAppMessage({
          to: passengerPhone,
          type: "text",
          text: {
            body: `✅ Your ride has been booked!\n\nPickup: ${ride.pickup_text || "Location shared"}\nDropoff: ${ride.dropoff_text || "To be confirmed"}\nDriver Ref: ${ride.driver?.ref_code || "N/A"}\n\nYour driver will contact you shortly to confirm pickup.`,
          },
          correlationId,
        });
        logStructured({
          event: "mobility_book_passenger_notified",
          status: "ok",
          correlationId,
          details: { ride_id, passenger_id },
        });
      } catch (notifyError) {
        logStructured({
          event: "mobility_book_passenger_notify_failed",
          status: "warning",
          correlationId,
          details: { ride_id, error: notifyError instanceof Error ? notifyError.message : "unknown" },
        });
      }
    }

    logStructured({
      event: "mobility_book_success",
      status: "ok",
      correlationId,
      details: { ride_id, driver_id, passenger_id },
    });

    return NextResponse.json({ 
      booked: true, 
      ride_id, 
      driver_id, 
      passenger_id,
      notifications_sent: {
        driver: !!driverPhone,
        passenger: !!passengerPhone,
      },
      reqId,
    }, { status: 200 });
    
  } catch (error) {
    logStructured({
      event: "mobility_book_error",
      status: "error",
      correlationId,
      details: { error: error instanceof Error ? error.message : "unknown" },
    });
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "mobility.book", status: "ok", reqId }, { status: 200 });
}

export const runtime = "nodejs";
