import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serveWithObservability } from "../_shared/observability.ts";
import { jsonCorsResponse, preflightResponse } from "../_shared/http.ts";
import { recordMetric } from "../_shared/metrics.ts";

/**
 * Gateway Health Check
 * Scheduled function that runs every 5 minutes to check for offline devices
 * and send alerts when devices haven't sent heartbeats
 */
serveWithObservability("gateway-health-check", async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get offline threshold from environment (default: 5 minutes)
    const thresholdMinutes = parseInt(
      Deno.env.get("GATEWAY_OFFLINE_THRESHOLD_MINUTES") ?? "5",
      10
    );

    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - thresholdMinutes);

    console.log("Running gateway health check", {
      threshold_minutes: thresholdMinutes,
      threshold_date: thresholdDate.toISOString(),
    });

    // Find devices that were active but haven't sent heartbeat recently
    const { data: staleDevices, error: staleError } = await supabase
      .from("gateway_devices")
      .select("id, device_id, device_name, sacco_id, last_heartbeat_at, sim_carrier")
      .eq("is_active", true)
      .lt("last_heartbeat_at", thresholdDate.toISOString());

    if (staleError) {
      console.error("Error fetching stale devices", staleError);
      throw staleError;
    }

    console.log(`Found ${staleDevices?.length ?? 0} stale devices`);

    if (!staleDevices || staleDevices.length === 0) {
      return jsonCorsResponse({
        success: true,
        message: "All devices are healthy",
        checked: new Date().toISOString(),
      });
    }

    // Mark devices as inactive
    const deviceIds = staleDevices.map((d) => d.device_id);
    const { error: updateError } = await supabase
      .from("gateway_devices")
      .update({ is_active: false })
      .in("device_id", deviceIds);

    if (updateError) {
      console.error("Error updating device status", updateError);
    }

    // Record metrics for offline devices
    await recordMetric(supabase, "gateway_devices_offline", staleDevices.length, {
      threshold_minutes: thresholdMinutes,
    });

    // Send alerts for each offline device
    const alertEmail = Deno.env.get("GATEWAY_OFFLINE_ALERT_EMAIL");
    const alerts = [];

    for (const device of staleDevices) {
      const minutesOffline = Math.floor(
        (Date.now() - new Date(device.last_heartbeat_at).getTime()) / (1000 * 60)
      );

      const alertMessage = {
        type: "GATEWAY_OFFLINE",
        device_id: device.device_id,
        device_name: device.device_name,
        sacco_id: device.sacco_id,
        sim_carrier: device.sim_carrier,
        last_heartbeat_at: device.last_heartbeat_at,
        minutes_offline: minutesOffline,
        severity: minutesOffline > 60 ? "HIGH" : "MEDIUM",
      };

      console.log("Device offline alert", alertMessage);
      alerts.push(alertMessage);

      // If email notifications are configured, send alert
      if (alertEmail) {
        try {
          // Use existing notification dispatch system
          const notificationPayload = {
            to: alertEmail,
            subject: `Gateway Offline Alert: ${device.device_name ?? device.device_id}`,
            body: `
Gateway device is offline:

Device ID: ${device.device_id}
Device Name: ${device.device_name ?? "Unknown"}
SIM Carrier: ${device.sim_carrier ?? "Unknown"}
Last Heartbeat: ${device.last_heartbeat_at}
Minutes Offline: ${minutesOffline}
Severity: ${minutesOffline > 60 ? "HIGH" : "MEDIUM"}

Please check the device and ensure it's connected to the network.
            `.trim(),
          };

          // Call notification-dispatch-email function
          const edgeUrl = Deno.env.get("EDGE_URL") ?? `${supabaseUrl}/functions/v1`;
          const hmacSecret = Deno.env.get("HMAC_SHARED_SECRET");

          if (hmacSecret) {
            const timestamp = new Date().toISOString();
            const message = JSON.stringify(notificationPayload);
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
              "raw",
              encoder.encode(hmacSecret),
              { name: "HMAC", hash: "SHA-256" },
              false,
              ["sign"]
            );
            const signature = await crypto.subtle.sign(
              "HMAC",
              key,
              encoder.encode(timestamp + "POST:/notification-dispatch-email" + message)
            );
            const signatureHex = Array.from(new Uint8Array(signature))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            await fetch(`${edgeUrl}/notification-dispatch-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-signature": signatureHex,
                "x-timestamp": timestamp,
              },
              body: message,
            });

            console.log("Alert email sent", { device_id: device.device_id, to: alertEmail });
          }
        } catch (emailError) {
          console.error("Failed to send alert email", emailError);
        }
      }
    }

    return jsonCorsResponse({
      success: true,
      message: `Found ${staleDevices.length} offline devices`,
      offline_devices: alerts,
      checked: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Gateway health check error", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonCorsResponse(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});
