// wa-webhook-mobility - Simplified version
// Simple flow: User chooses ride → shares location → sees list of drivers/passengers
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/state/store.ts";
import { isValidInternalForward } from "../_shared/security/internal-forward.ts";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { supabase } from "./config.ts";
import type { SupportedLanguage } from "./i18n/language.ts";
import type { WhatsAppWebhookPayload } from "./types.ts";
import { sendButtons, sendList, sendText } from "./wa/client.ts";

// Button IDs
const BUTTON_IDS = {
  RIDE: "ride",
  DRIVER: "driver",
  PASSENGER: "passenger",
} as const;

serve(async (req: Request): Promise<Response> => {
  const respond = (body: unknown, status = 200): Response => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  // Health check
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return respond({ status: "ok" });
    }
    return respond({ error: "not_found" }, 404);
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned =
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";
    const internalForward = isValidInternalForward(req);

    if (!appSecret) {
      logStructuredEvent("MOBILITY_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, 500);
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
        if (isValidSignature) {
          logStructuredEvent("MOBILITY_SIGNATURE_VALID", {
            signatureHeader,
            correlationId,
          });
        }
      } catch (err) {
        logStructuredEvent("MOBILITY_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logStructuredEvent("MOBILITY_AUTH_BYPASS", {
          reason: internalForward
            ? "internal_forward"
            : signature
            ? "signature_mismatch"
            : "no_signature",
          correlationId,
        }, "warn");
      } else {
        logStructuredEvent("MOBILITY_AUTH_FAILED", {
          signatureProvided: !!signature,
          correlationId,
        }, "warn");
        return respond({ error: "unauthorized" }, 401);
      }
    }

    // Parse payload
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contacts = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !message.from) {
      return respond({ success: true });
    }

    const from = message.from;
    const profileName = contacts?.profile?.name || "User";

    // Ensure user exists
    let profileId = "";
    let locale: SupportedLanguage = "en";
    let userId = "";

    try {
      const { data: profileData, error: profileError } = await supabase.rpc(
        "ensure_whatsapp_user",
        {
          _wa_id: from,
          _profile_name: profileName,
        },
      );

      if (!profileError && profileData && profileData.length > 0) {
        profileId = profileData[0]?.profile_id || "";
        userId = profileData[0]?.user_id || "";
        locale = (profileData[0]?.locale || "en") as SupportedLanguage;
      } else {
        // Fallback to ensureProfile utility
        const profile = await ensureProfile(supabase, from);
        if (profile) {
          userId = profile.user_id;
          locale = (profile.locale || "en") as SupportedLanguage;
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          profileId = profileRow?.id || "";
        } else {
          logStructuredEvent("MOBILITY_USER_ENSURE_ERROR", {
            error: "Failed to create profile",
            from: from.slice(-4),
            correlationId,
          }, "error");
          return respond({ error: "user_creation_failed" }, 500);
        }
      }
    } catch (err) {
      logStructuredEvent("MOBILITY_USER_ENSURE_ERROR", {
        error: err instanceof Error ? err.message : String(err),
        from: from.slice(-4),
        correlationId,
      }, "error");
      return respond({ error: "user_creation_failed" }, 500);
    }

    // Context for potential future use
    // const ctx: RouterContext = {
    //   supabase,
    //   from,
    //   profileId,
    //   locale,
    // };

    // Get user's mobility role from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("mobility_role")
      .eq("user_id", userId)
      .maybeSingle();

    const mobilityRole = profile?.mobility_role as "driver" | "passenger" | null;

    // Simple state tracking (we'll use a simple approach without user_state table for now)
    // State is handled per-request based on user's role and current flow

    // Handle interactive messages (buttons)
    if (message.type === "interactive") {
      const interactive = message.interactive as {
        button_reply?: { id?: string };
        list_reply?: { id?: string };
      };
      const id = interactive?.button_reply?.id || interactive?.list_reply?.id;

      if (!id) {
        return respond({ success: true });
      }

      // User chose "ride" from home menu
      if (id === BUTTON_IDS.RIDE || id === "rides" || id === "rides_agent") {
        // Check if user has mobility role set
        if (!mobilityRole) {
          // First time - ask for role
          await sendButtons(
            from,
            "Are you a driver or passenger?",
            [
              { id: BUTTON_IDS.DRIVER, title: "🚗 Driver" },
              { id: BUTTON_IDS.PASSENGER, title: "👤 Passenger" },
            ],
          );
          // State is implicit - user needs to select role
        } else {
          // User has role - ask for location
          await sendText(
            from,
            "Please share your current location 📍",
          );
          // State is implicit - user needs to share location
        }
        return respond({ success: true });
      }

      // User selected driver or passenger
      if (id === BUTTON_IDS.DRIVER || id === BUTTON_IDS.PASSENGER) {
        const role = id === BUTTON_IDS.DRIVER ? "driver" : "passenger";
        // Save role to profile
        await supabase
          .from("profiles")
          .update({ mobility_role: role })
          .eq("user_id", userId);
        // Ask for location
        await sendText(
          from,
          "Please share your current location 📍",
        );
        // State is implicit - user needs to share location
        return respond({ success: true });
      }
    }

    // Handle location messages
    if (message.type === "location") {
      const loc = message.location as
        | { latitude?: number; longitude?: number }
        | undefined;
      if (loc?.latitude && loc?.longitude) {
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);

        // Validate coordinates
        if (
          isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 ||
          lng > 180
        ) {
          logStructuredEvent("MOBILITY_INVALID_LOCATION", {
            lat,
            lng,
            from: from.slice(-4),
            correlationId,
          }, "warn");
          return respond({ error: "invalid_location" }, 400);
        }

        // Check if user has role
        if (!mobilityRole) {
          await sendButtons(
            from,
            "Please select your role first:",
            [
              { id: BUTTON_IDS.DRIVER, title: "🚗 Driver" },
              { id: BUTTON_IDS.PASSENGER, title: "👤 Passenger" },
            ],
          );
          return respond({ success: true });
        }

        // Save location to trips table (active ride request)
        const { data: tripData, error: tripError } = await supabase
          .from("trips")
          .insert({
            user_id: userId,
            phone: from,
            role: mobilityRole,
            vehicle_type: "car", // Default, can be enhanced later
            pickup_lat: lat,
            pickup_lng: lng,
            status: "open",
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
          })
          .select()
          .single();

        if (tripError) {
          logStructuredEvent("MOBILITY_TRIP_CREATE_ERROR", {
            error: tripError.message,
            from: from.slice(-4),
            correlationId,
          }, "error");
          await sendText(from, "Sorry, there was an error. Please try again.");
          return respond({ success: true });
        }

        if (!tripData) {
          logStructuredEvent("MOBILITY_TRIP_CREATE_NO_DATA", {
            from: from.slice(-4),
            correlationId,
          }, "error");
          await sendText(from, "Sorry, there was an error. Please try again.");
          return respond({ success: true });
        }

        // Find opposite role users (top 10) - simple query
        const oppositeRole = mobilityRole === "driver" ? "passenger" : "driver";
        
        // Simple query to find nearby trips with opposite role
        // Using Haversine distance calculation (simplified)
        const { data: matches, error: matchError } = await supabase
          .from("trips")
          .select(`
            id,
            phone,
            pickup_lat,
            pickup_lng,
            ref_code,
            created_at,
            profiles!inner(full_name, phone_number, wa_id)
          `)
          .eq("role", oppositeRole)
          .eq("status", "open")
          .gt("expires_at", new Date().toISOString())
          .neq("user_id", userId) // Exclude own trips
          .order("created_at", { ascending: false })
          .limit(10);

        if (matchError) {
          logStructuredEvent("MOBILITY_MATCH_ERROR", {
            error: matchError.message,
            from: from.slice(-4),
            correlationId,
          }, "error");
        }

        // State cleared - location received and processed

        // Send list of matches
        if (matches && Array.isArray(matches) && matches.length > 0) {
          // Calculate simple distance for each match (Haversine formula simplified)
          const rows = matches.slice(0, 10).map((match: {
            id?: string;
            phone?: string;
            pickup_lat?: number;
            pickup_lng?: number;
            ref_code?: string;
            profiles?: { full_name?: string; phone_number?: string };
          }, index: number) => {
            // Simple distance calculation (approximate)
            const latDiff = Math.abs(lat - (match.pickup_lat || 0));
            const lngDiff = Math.abs(lng - (match.pickup_lng || 0));
            const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough conversion
            const estimatedMinutes = Math.round(distanceKm * 2); // Rough estimate: 2 min per km
            
            const displayName = match.profiles?.full_name || 
                               match.profiles?.phone_number || 
                               match.phone || 
                               "User";
            
            return {
              id: `contact_${match.phone || match.id || index}`,
              title: `${displayName}`,
              description: `📍 ${match.ref_code || ""} | ~${estimatedMinutes} min away`,
            };
          });

          await sendList(from, {
            title: `Available ${oppositeRole === "driver" ? "Drivers" : "Passengers"}`,
            body: `Found ${matches.length} ${oppositeRole}s nearby. Your location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            buttonText: "Select",
            rows,
          });
        } else {
          await sendText(
            from,
            `No ${oppositeRole}s found nearby. Your location has been saved. Try again later.`,
          );
        }

        logStructuredEvent("MOBILITY_LOCATION_SAVED", {
          from: from.slice(-4),
          role: mobilityRole,
          lat,
          lng,
          matches_count: matches?.length || 0,
          correlationId,
        });
      }
      return respond({ success: true });
    }

    // Handle text messages
    if (message.type === "text") {
      const textMessage = message.text as { body?: string } | undefined;
      const text = (textMessage?.body?.toLowerCase() || "").trim();

      // Main menu triggers
      if (
        text === "rides" ||
        text === "rides_agent" ||
        text === "ride" ||
        text === "mobility" ||
        text === "transport" ||
        text === "taxi" ||
        text === "menu"
      ) {
        // Same as button handler
        if (!mobilityRole) {
          await sendButtons(
            from,
            "Are you a driver or passenger?",
            [
              { id: BUTTON_IDS.DRIVER, title: "🚗 Driver" },
              { id: BUTTON_IDS.PASSENGER, title: "👤 Passenger" },
            ],
          );
          // State is implicit
        } else {
          await sendText(
            from,
            "Please share your current location 📍",
          );
          // State is implicit
        }
        return respond({ success: true });
      }
    }

    return respond({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logStructuredEvent("MOBILITY_ERROR", {
      service: "wa-webhook-mobility",
      requestId,
      correlationId,
      error: errorMessage,
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      stack: errorStack,
    }, "error");
    return respond({ error: "internal_error" }, 500);
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-mobility",
  version: "3.0.0",
});
