import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState, setState, clearState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
// Note: Rate limiting removed - handled by wa-webhook-core (100 req/min per phone number)
// Static imports for frequently used handlers to reduce dynamic import overhead
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";

const profileConfig = WEBHOOK_CONFIG.profile;

const SERVICE_NAME = "wa-webhook-profile";
const SERVICE_VERSION = "3.0.0"; // v3.0.0: Wallet functionality extracted to wa-webhook-wallet
const MAX_BODY_SIZE = profileConfig.maxBodySize;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  // Note: Rate limiting handled by wa-webhook-core before forwarding to this service
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: SERVICE_NAME,
      requestId,
      correlationId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      // Probe a guaranteed table to avoid false negatives during schema rollout
      const { error } = await supabase.from("profiles").select("user_id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected", table: "profiles" },
        version: SERVICE_VERSION,
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        service: SERVICE_NAME,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler
  try {
    const rawBody = await req.text();
    
    // Security: Body size validation
    if (rawBody.length > MAX_BODY_SIZE) {
      logEvent("PROFILE_BODY_TOO_LARGE", { size: rawBody.length }, "warn");
      return respond({ error: "payload_too_large" }, { status: 413 });
    }
    
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";

    if (signatureHeader && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid && !allowUnsigned) {
        logEvent("PROFILE_AUTH_FAILED", { signatureHeader }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    } else if (!allowUnsigned) {
      logEvent("PROFILE_AUTH_MISSING_SIGNATURE", {}, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload with error handling
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logEvent("PROFILE_INVALID_JSON", {}, "warn");
      return respond({ error: "invalid_payload" }, { status: 400 });
    }
    
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return respond({ success: true, ignored: "no_message" });
    }

    const from = message.from;
    if (!from) {
      return respond({ success: true, ignored: "no_sender" });
    }

    // Idempotency: Check if we've already processed this message
    const messageId = (message as any).id; // WhatsApp message ID (wamid)
    if (messageId) {
      // Check if we've processed this message in the last 5 minutes
      const { data: processed } = await supabase
        .from("processed_webhooks")
        .select("id")
        .eq("message_id", messageId)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .maybeSingle();
      
      if (processed) {
        logEvent("PROFILE_DUPLICATE_MESSAGE", { messageId, from }, "debug");
        return respond({ success: true, ignored: "duplicate" });
      }
      
      // Mark as processed (fire and forget - don't await)
      supabase
        .from("processed_webhooks")
        .insert({
          message_id: messageId,
          phone_number: from,
          webhook_type: "profile",
          created_at: new Date().toISOString(),
        })
        .then(() => {
          // Success - no action needed
        }, (err: Error) => {
          logEvent("PROFILE_IDEMPOTENCY_INSERT_FAILED", { error: err.message }, "warn");
        });
    }

    // Build Context - Auto-create profile if needed
    const profile = await ensureProfile(supabase, from);

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    logEvent("PROFILE_MESSAGE_PROCESSING", { from, type: message.type, hasProfile: !!profile });

    // Get State
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;
    logEvent("PROFILE_STATE", { key: state?.key });

    let handled = false;

    // Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactive = message.interactive as any;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {
        logEvent("PROFILE_INTERACTION", { id });

        // Profile Home
        if (id === "profile") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Profile Edit
        else if (id === "EDIT_PROFILE" || id === "edit_profile") {
          const { startEditProfile } = await import("./handlers/edit.ts");
          handled = await startEditProfile(ctx);
        }
        else if (id === "EDIT_PROFILE_NAME") {
          const { promptEditName } = await import("./handlers/edit.ts");
          handled = await promptEditName(ctx);
        }
        else if (id === "EDIT_PROFILE_LANGUAGE") {
          const { promptEditLanguage } = await import("./handlers/edit.ts");
          handled = await promptEditLanguage(ctx);
        }
        else if (id.startsWith("LANG::")) {
          const languageCode = id.replace("LANG::", "");
          const { handleEditLanguage } = await import("./handlers/edit.ts");
          handled = await handleEditLanguage(ctx, languageCode);
        }
        
        // MoMo QR Code
        else if (id === "MOMO_QR" || id === "momo_qr") {
          const { startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
        // MoMo QR Flow buttons
        else if (id === IDS.MOMO_QR_MY || id === IDS.MOMO_QR_NUMBER || id === IDS.MOMO_QR_CODE) {
          const { handleMomoButton } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          handled = await handleMomoButton(ctx, id, state ?? { key: "home", data: {} });
        }
        
        // Saved Locations
        else if (id === IDS.SAVED_LOCATIONS || id === "SAVED_LOCATIONS" || id === "saved_locations") {
          const { listSavedLocations } = await import("./handlers/locations.ts");
          handled = await listSavedLocations(ctx);
        }
        else if (id === IDS.ADD_LOCATION || id === "add_location") {
          // Show list of location types to add
          await sendListMessage(
            ctx,
            {
              title: "📍 Add Saved Location",
              body: "Choose the type of location you want to save:",
              sectionTitle: "Location Type",
              buttonText: "Choose",
              rows: [
                {
                  id: "ADD_LOC::home",
                  title: "🏠 Home",
                  description: "Save your home address",
                },
                {
                  id: "ADD_LOC::work",
                  title: "💼 Work",
                  description: "Save your work address",
                },
                {
                  id: "ADD_LOC::school",
                  title: "🎓 School",
                  description: "Save your school address",
                },
                {
                  id: "ADD_LOC::other",
                  title: "📍 Other",
                  description: "Save another favorite place",
                },
                {
                  id: IDS.SAVED_LOCATIONS,
                  title: "← Cancel",
                  description: "Back to saved locations",
                },
              ],
            },
            { emoji: "➕" },
          );
          handled = true;
        }
        else if (id.startsWith("LOC::")) {
          const locationId = id.replace("LOC::", "");
          const { handleLocationSelection } = await import("./handlers/locations.ts");
          handled = await handleLocationSelection(ctx, locationId);
        }
        else if (id.startsWith("ADD_LOC::")) {
          const locationType = id.replace("ADD_LOC::", "");
          if (ctx.profileId) {
            await setState(ctx.supabase, ctx.profileId, {
              key: "add_location",
              data: { type: locationType },
            });
            await sendButtonsMessage(
              ctx,
              `📍 *Add ${locationType.charAt(0).toUpperCase() + locationType.slice(1)} Location*\n\nPlease share your location or send the address.`,
              [
                { id: IDS.SAVED_LOCATIONS, title: "← Cancel" },
              ],
            );
            handled = true;
          }
        }
        
        // Confirm Save Location
        else if (id.startsWith("CONFIRM_SAVE_LOC::")) {
          const locationType = id.replace("CONFIRM_SAVE_LOC::", "");
          if (!ctx.profileId || !state || state.key !== "confirm_add_location" || !state.data) {
            handled = false;
          } else {
            const { lat, lng, address } = state.data as { lat: number; lng: number; address?: string };
            
            // Show loading state
            await sendText(ctx.from, "⏳ Saving location...");
            
            const { error } = await ctx.supabase
              .from("saved_locations")
              .insert({
                user_id: ctx.profileId,
                label: locationType,
                lat,
                lng,
                address: address || null,
              });
            
            // Also save to location cache (30-min TTL) for use by other services
            if (!error) {
              try {
                await ctx.supabase.rpc('update_user_location_cache', {
                  _user_id: ctx.profileId,
                  _lat: lat,
                  _lng: lng
                });
                logEvent("PROFILE_LOCATION_CACHED", { 
                  user: ctx.profileId, 
                  type: locationType,
                  lat, 
                  lng 
                });
              } catch (cacheError) {
                // Log but don't fail - saved location is more important
                logEvent("PROFILE_CACHE_FAILED", { 
                  error: cacheError instanceof Error ? cacheError.message : String(cacheError) 
                }, "warn");
              }
            }
            
            await clearState(ctx.supabase, ctx.profileId);
            
            if (error) {
              await sendButtonsMessage(
                ctx,
                `⚠️ Failed to save location: ${error.message}`,
                [
                  { id: IDS.SAVED_LOCATIONS, title: "📍 Try Again" },
                  { id: IDS.BACK_PROFILE, title: "← Back" },
                ],
              );
            } else {
              await sendButtonsMessage(
                ctx,
                `✅ Your ${locationType} location has been saved!\n\nYou can now use it for rides and deliveries.`,
                [
                  { id: IDS.SAVED_LOCATIONS, title: "📍 View Locations" },
                  { id: IDS.BACK_PROFILE, title: "← Back" },
                ],
              );
            }
            handled = true;
          }
        }
        
        // Use Saved Location
        else if (id.startsWith("USE_LOC::")) {
          const locationId = id.replace("USE_LOC::", "");
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { data: location } = await ctx.supabase
              .from("saved_locations")
              .select("*")
              .eq("id", locationId)
              .eq("user_id", ctx.profileId)
              .maybeSingle();
            
            if (!location) {
              await sendButtonsMessage(
                ctx,
                "⚠️ Location not found or no longer available.",
                [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
              );
              handled = true;
            } else {
              await sendButtonsMessage(
                ctx,
                `📍 *Using: ${location.label}*\n\n` +
                `${location.address || `Coordinates: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}\n\n` +
                `What would you like to do with this location?`,
                [
                  { id: "RIDE_FROM_HERE", title: "🚖 Get a ride" },
                  { id: "SCHEDULE_FROM_HERE", title: "📅 Schedule trip" },
                  { id: IDS.SAVED_LOCATIONS, title: "← Back" },
                ],
              );
              handled = true;
            }
          }
        }
        
        // Edit Saved Location
        else if (id.startsWith("EDIT_LOC::")) {
          const locationId = id.replace("EDIT_LOC::", "");
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { data: location } = await ctx.supabase
              .from("saved_locations")
              .select("*")
              .eq("id", locationId)
              .eq("user_id", ctx.profileId)
              .maybeSingle();
            
            if (!location) {
              await sendButtonsMessage(
                ctx,
                "⚠️ Location not found or no longer available.",
                [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
              );
              handled = true;
            } else {
              await setState(ctx.supabase, ctx.profileId, {
                key: "edit_location",
                data: { locationId, originalLabel: location.label },
              });
              await sendButtonsMessage(
                ctx,
                `📍 *Edit: ${location.label}*\n\n` +
                `Current: ${location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}\n\n` +
                `Share a new location to update this saved location.`,
                [
                  { id: `LOC::${locationId}`, title: "← Cancel" },
                ],
              );
              handled = true;
            }
          }
        }
        
        // Delete Saved Location
        else if (id.startsWith("DELETE_LOC::")) {
          const locationId = id.replace("DELETE_LOC::", "");
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { data: location } = await ctx.supabase
              .from("saved_locations")
              .select("label")
              .eq("id", locationId)
              .eq("user_id", ctx.profileId)
              .maybeSingle();
            
            if (!location) {
              await sendButtonsMessage(
                ctx,
                "⚠️ Location not found or no longer available.",
                [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
              );
              handled = true;
            } else {
              await setState(ctx.supabase, ctx.profileId, {
                key: "delete_location_confirm",
                data: { locationId, label: location.label },
              });
              await sendButtonsMessage(
                ctx,
                `🗑️ *Delete Location?*\n\n` +
                `Are you sure you want to delete "${location.label}"?\n\n` +
                `This action cannot be undone.`,
                [
                  { id: `CONFIRM_DELETE_LOC::${locationId}`, title: "✅ Yes, delete" },
                  { id: `LOC::${locationId}`, title: "❌ Cancel" },
                ],
              );
              handled = true;
            }
          }
        }
        
        // Confirm Delete Saved Location
        else if (id.startsWith("CONFIRM_DELETE_LOC::")) {
          const locationId = id.replace("CONFIRM_DELETE_LOC::", "");
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { error } = await ctx.supabase
              .from("saved_locations")
              .delete()
              .eq("id", locationId)
              .eq("user_id", ctx.profileId);
            
            if (error) {
              await sendButtonsMessage(
                ctx,
                `⚠️ Failed to delete location: ${error.message}`,
                [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
              );
              logEvent("LOCATION_DELETE_FAILED", { locationId, error: error.message }, "error");
            } else {
              await clearState(ctx.supabase, ctx.profileId);
              await sendButtonsMessage(
                ctx,
                "✅ Location deleted successfully!",
                [{ id: IDS.SAVED_LOCATIONS, title: "📍 View Locations" }],
              );
              logEvent("LOCATION_DELETED", { locationId });
            }
            handled = true;
          }
        }
        
        // Back to Profile
        else if (id === IDS.BACK_PROFILE) {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Back to Menu (from submenus)
        else if (id === IDS.BACK_MENU || id === "back_menu") {
          const { startProfile } = await import("./handlers/menu.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Share EasyMO
        else if (id === IDS.SHARE_EASYMO) {
          if (ctx.profileId) {
            const { ensureReferralLink } = await import("../_shared/wa-webhook-shared/utils/share.ts");
            const { t } = await import("../_shared/wa-webhook-shared/i18n/translator.ts");
            try {
              const link = await ensureReferralLink(ctx.supabase, ctx.profileId);
              const shareText = [
                t(ctx.locale, "wallet.earn.forward.instructions"),
                t(ctx.locale, "wallet.earn.share_text_intro"),
                link.waLink,
                t(ctx.locale, "wallet.earn.copy.code", { code: link.code }),
                t(ctx.locale, "wallet.earn.note.keep_code"),
              ].join("\n\n");
              
              await sendButtonsMessage(
                ctx,
                shareText,
                [
                  { id: IDS.WALLET_EARN, title: t(ctx.locale, "wallet.earn.button") },
                  { id: IDS.BACK_PROFILE, title: "← Back" },
                ],
              );
              handled = true;
            } catch (e) {
              await sendButtonsMessage(
                ctx,
                t(ctx.locale, "wallet.earn.error"),
                [{ id: IDS.BACK_PROFILE, title: "← Back" }],
              );
              handled = true;
            }
          }
        }
        
        
        // MoMo QR
        else if (id === IDS.MOMO_QR || id.startsWith("momoqr_")) {
          const { handleMomoButton, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          const momoState = state ?? { key: "momo_qr_menu", data: {} };
          if (id === IDS.MOMO_QR) {
            handled = await startMomoQr(ctx, momoState);
          } else {
            handled = await handleMomoButton(ctx, id, momoState);
          }
        }
        
      }
    }

    // Handle Text Messages
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      const originalText = (message.text as any)?.body?.trim() ?? "";
      const upperText = originalText.toUpperCase();
      
      // PRIORITY: Check for referral code (REF:CODE or standalone 6-12 char alphanumeric code)
      // This handles new users who click referral links and send the code
      // Patterns match wa-webhook-core/router.ts for consistency
      const refMatch = originalText.match(/^REF[:\s]+([A-Z0-9]{4,12})$/i);
      const isStandaloneCode = /^[A-Z0-9]{6,12}$/.test(upperText) && 
                              !/^(HELLO|THANKS|CANCEL|SUBMIT|ACCEPT|REJECT|STATUS|URGENT|PLEASE|PROFILE|WALLET)$/.test(upperText);
      
      if (refMatch || isStandaloneCode) {
        // Referral codes are handled by wa-webhook-wallet
        logEvent("PROFILE_REFERRAL_DEPRECATED", { type: "referral_code" }, "warn");
        await sendText(
          ctx.from,
          "⚠️ Referral feature has been moved. Please restart by sending 'hi' or 'menu'."
        );
        handled = true;
      }
      // Check for menu selection key first
      else if (text === "profile") {
        const { startProfile } = await import("./handlers/menu.ts");
        handled = await startProfile(ctx, state ?? { key: "home" });
      }
      
      // MOMO QR Text - handle state-based input or keywords
      else if (state?.key?.startsWith("momo_qr") || text.includes("momo") || text.includes("qr")) {
        const { handleMomoText, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        if (state?.key?.startsWith("momo_qr")) {
            // User is in MoMo flow, handle their text input
            handled = await handleMomoText(ctx, (message.text as any)?.body ?? "", state);
        } else {
            // User mentioned "momo" or "qr", start the flow
            handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
      }

      
      
      // Handle profile edit name
      else if (state?.key === IDS.EDIT_PROFILE_NAME) {
        const { handleEditName } = await import("./handlers/edit.ts");
        handled = await handleEditName(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle add location (text address)
      else if (state?.key === IDS.ADD_LOCATION && message.type === "text") {
        if (ctx.profileId && state.data?.type) {
          const address = (message.text as any)?.body ?? "";
          const locationType = state.data.type as string;
          
          // For now, just confirm receipt - actual location saving would need geocoding
          await clearState(ctx.supabase, ctx.profileId);
          
          await sendButtonsMessage(
            ctx,
            `✅ Thank you! We've received your ${locationType} address:\n\n${address}\n\nTo save it with coordinates, please share your location using WhatsApp's location feature.`,
            [
              { id: IDS.SAVED_LOCATIONS, title: "📍 Locations" },
              { id: IDS.BACK_PROFILE, title: "← Back" },
            ],
          );
          handled = true;
        }
      }
    }
    
    // ============================================================
    // PHASE 2: Menu Upload Media Handler
    // ============================================================
    
    // Handle location messages (when user shares location)
    else if (message.type === "location" && (state?.key === IDS.ADD_LOCATION || state?.key === "edit_location")) {
      if (ctx.profileId) {
        const location = (message as any).location;
        const lat = location?.latitude;
        const lng = location?.longitude;
        
        // Validate coordinates
        if (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          await sendButtonsMessage(
            ctx,
            "⚠️ Invalid location coordinates. Please try again.",
            [
              { id: IDS.SAVED_LOCATIONS, title: "📍 Saved Locations" },
              { id: IDS.BACK_PROFILE, title: "← Back" },
            ],
          );
          handled = true;
        } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          await sendButtonsMessage(
            ctx,
            "⚠️ Coordinates out of valid range. Please share a valid location.",
            [
              { id: IDS.SAVED_LOCATIONS, title: "📍 Saved Locations" },
              { id: IDS.BACK_PROFILE, title: "← Back" },
            ],
          );
          logEvent("INVALID_COORDINATES", { lat, lng }, "warn");
          handled = true;
        } else if (state.key === IDS.ADD_LOCATION && state.data?.type) {
          // Show confirmation first
          const locationType = state.data.type as string;
          const address = location?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          
          if (ctx.profileId) {
            await setState(ctx.supabase, ctx.profileId, {
              key: "confirm_add_location",
              data: { 
                type: locationType,
                lat,
                lng,
                address: location?.address || null,
              },
            });
          }
          
          await sendButtonsMessage(
            ctx,
            `📍 *Confirm ${locationType.charAt(0).toUpperCase() + locationType.slice(1)} Location*\n\n` +
            `Address: ${address}\n` +
            `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}\n\n` +
            `Is this correct?`,
            [
              { id: `CONFIRM_SAVE_LOC::${locationType}`, title: "✅ Yes, save it" },
              { id: IDS.SAVED_LOCATIONS, title: "❌ Cancel" },
            ],
          );
          handled = true;
        } else if (state.key === "edit_location" && state.data?.locationId) {
          // Update existing location
          const locationId = state.data.locationId;
          const { error } = await ctx.supabase
            .from("saved_locations")
            .update({
              lat,
              lng,
              address: location?.address || null,
            })
            .eq("id", locationId)
            .eq("user_id", ctx.profileId);
          
          // Also update location cache
          if (!error) {
            try {
              await ctx.supabase.rpc('update_user_location_cache', {
                _user_id: ctx.profileId,
                _lat: lat,
                _lng: lng
              });
              logEvent("PROFILE_LOCATION_UPDATED_CACHED", { 
                user: ctx.profileId, 
                locationId,
                lat, 
                lng 
              });
            } catch (cacheError) {
              logEvent("PROFILE_CACHE_FAILED", { 
                error: cacheError instanceof Error ? cacheError.message : String(cacheError) 
              }, "warn");
            }
          }
          
          await clearState(ctx.supabase, ctx.profileId);
          
          if (error) {
            await sendButtonsMessage(
              ctx,
              `⚠️ Failed to update location: ${error.message}`,
              [
                { id: `LOC::${locationId}`, title: "← Back" },
                { id: IDS.SAVED_LOCATIONS, title: "📍 Locations" },
              ],
            );
          } else {
            await sendButtonsMessage(
              ctx,
              `✅ Location updated successfully!`,
              [
                { id: `LOC::${locationId}`, title: "📍 View Location" },
                { id: IDS.SAVED_LOCATIONS, title: "📍 All Locations" },
              ],
            );
          }
          handled = true;
        }
      }
    }

    // Fallback: Detect phone number pattern (for MoMo QR without keywords)
    if (!handled && message.type === "text") {
      const text = (message.text as any)?.body?.trim() ?? "";
      // Match phone patterns: +250788123456, 0788123456, 788123456, etc.
      const phonePattern = /^(\+?\d{10,15}|\d{9,10})$/;
      if (phonePattern.test(text.replace(/[\s\-]/g, ''))) {
        // Looks like a phone number, treat as MoMo QR input
        const { handleMomoText } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        handled = await handleMomoText(ctx, text, state ?? { key: "home" });
      }
    }

    if (!handled) {
      logEvent("PROFILE_UNHANDLED_MESSAGE", { from, type: message.type });
    }

    return respond({ success: true, handled });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent("PROFILE_WEBHOOK_ERROR", { error: message }, "error");
    await logStructuredEvent("ERROR", { data: "profile.webhook_error", message });

    return respond({
      error: "internal_error",
      service: SERVICE_NAME,
      requestId,
    }, {
      status: 500,
    });
  }
});

logStructuredEvent("SERVICE_STARTED", { 
  service: SERVICE_NAME,
  version: SERVICE_VERSION,
});
