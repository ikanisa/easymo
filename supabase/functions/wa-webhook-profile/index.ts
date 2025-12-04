import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
// Note: Rate limiting removed - handled by wa-webhook-core before forwarding

const SERVICE_NAME = "wa-webhook-profile";
const SERVICE_VERSION = "2.2.1";
const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB limit for profile photos

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
    headers.set("X-Service", "wa-webhook-profile");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: "wa-webhook-profile",
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
      const { verifyWebhookSignature } = await import("../_shared/webhook-utils.ts");
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

    // Build Context - Auto-create profile if needed
    const { ensureProfile } = await import("../_shared/wa-webhook-shared/utils/profile.ts");
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
          const { startProfile } = await import("./profile/home.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Profile Edit
        else if (id === "EDIT_PROFILE" || id === "edit_profile") {
          const { startEditProfile } = await import("./profile/edit.ts");
          handled = await startEditProfile(ctx);
        }
        else if (id === "EDIT_PROFILE_NAME") {
          const { promptEditName } = await import("./profile/edit.ts");
          handled = await promptEditName(ctx);
        }
        else if (id === "EDIT_PROFILE_LANGUAGE") {
          const { promptEditLanguage } = await import("./profile/edit.ts");
          handled = await promptEditLanguage(ctx);
        }
        else if (id.startsWith("LANG::")) {
          const languageCode = id.replace("LANG::", "");
          const { handleEditLanguage } = await import("./profile/edit.ts");
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
        
        // Wallet Home
        else if (id === IDS.WALLET_HOME || id === "WALLET_HOME" || id === IDS.WALLET || id === "wallet" || id === "wallet_tokens") {
          const { startWallet } = await import("./wallet/home.ts");
          handled = await startWallet(ctx, state ?? { key: "home" });
        }
        
        // My Businesses
        else if (id === IDS.MY_BUSINESSES || id === "MY_BUSINESSES" || id === "my_business") {
          const { listMyBusinesses } = await import("./business/list.ts");
          handled = await listMyBusinesses(ctx);
        }
        else if (id === IDS.CREATE_BUSINESS) {
          const { startCreateBusiness } = await import("./business/list.ts");
          handled = await startCreateBusiness(ctx);
        }
        else if (id.startsWith("BIZ::")) {
          const businessId = id.replace("BIZ::", "");
          const { handleBusinessSelection } = await import("./business/list.ts");
          handled = await handleBusinessSelection(ctx, businessId);
        }
        else if (id.startsWith("EDIT_BIZ::")) {
          const businessId = id.replace("EDIT_BIZ::", "");
          const { startEditBusiness } = await import("./business/update.ts");
          handled = await startEditBusiness(ctx, businessId);
        }
        else if (id.startsWith("DELETE_BIZ::")) {
          const businessId = id.replace("DELETE_BIZ::", "");
          const { confirmDeleteBusiness } = await import("./business/delete.ts");
          handled = await confirmDeleteBusiness(ctx, businessId);
        }
        else if (id.startsWith("CONFIRM_DELETE_BIZ::")) {
          const businessId = id.replace("CONFIRM_DELETE_BIZ::", "");
          const { handleDeleteBusiness } = await import("./business/delete.ts");
          handled = await handleDeleteBusiness(ctx, businessId);
        }
        else if (id.startsWith("EDIT_BIZ_NAME::")) {
          const businessId = id.replace("EDIT_BIZ_NAME::", "");
          const { promptEditField } = await import("./business/update.ts");
          handled = await promptEditField(ctx, businessId, "name");
        }
        else if (id.startsWith("EDIT_BIZ_DESC::")) {
          const businessId = id.replace("EDIT_BIZ_DESC::", "");
          const { promptEditField } = await import("./business/update.ts");
          handled = await promptEditField(ctx, businessId, "description");
        }
        else if (id.startsWith("BACK_BIZ::")) {
          const businessId = id.replace("BACK_BIZ::", "");
          const { handleBusinessSelection } = await import("./business/list.ts");
          handled = await handleBusinessSelection(ctx, businessId);
        }
        
        // My Jobs
        else if (id === IDS.MY_JOBS || id === "MY_JOBS" || id === "my_jobs") {
          const { listMyJobs } = await import("./jobs/list.ts");
          handled = await listMyJobs(ctx);
        }
        else if (id.startsWith("JOB::")) {
          const jobId = id.replace("JOB::", "");
          const { handleJobSelection } = await import("./jobs/list.ts");
          handled = await handleJobSelection(ctx, jobId);
        }
        else if (id === IDS.CREATE_JOB) {
          const { startCreateJob } = await import("./jobs/create.ts");
          handled = await startCreateJob(ctx);
        }
        else if (id.startsWith("EDIT_JOB::")) {
          const jobId = id.replace("EDIT_JOB::", "");
          const { startEditJob } = await import("./jobs/update.ts");
          handled = await startEditJob(ctx, jobId);
        }
        else if (id.startsWith("DELETE_JOB::")) {
          const jobId = id.replace("DELETE_JOB::", "");
          const { confirmDeleteJob } = await import("./jobs/delete.ts");
          handled = await confirmDeleteJob(ctx, jobId);
        }
        else if (id.startsWith("CONFIRM_DELETE_JOB::")) {
          const jobId = id.replace("CONFIRM_DELETE_JOB::", "");
          const { handleDeleteJob } = await import("./jobs/delete.ts");
          handled = await handleDeleteJob(ctx, jobId);
        }
        else if (id.startsWith("EDIT_JOB_TITLE::")) {
          const jobId = id.replace("EDIT_JOB_TITLE::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "title");
        }
        else if (id.startsWith("EDIT_JOB_DESC::")) {
          const jobId = id.replace("EDIT_JOB_DESC::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "description");
        }
        else if (id.startsWith("EDIT_JOB_LOC::")) {
          const jobId = id.replace("EDIT_JOB_LOC::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "location");
        }
        else if (id.startsWith("EDIT_JOB_REQ::")) {
          const jobId = id.replace("EDIT_JOB_REQ::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "requirements");
        }
        else if (id.startsWith("BACK_JOB::")) {
          const jobId = id.replace("BACK_JOB::", "");
          const { handleJobSelection } = await import("./jobs/list.ts");
          handled = await handleJobSelection(ctx, jobId);
        }
        
        // My Properties
        else if (id === IDS.MY_PROPERTIES || id === "MY_PROPERTIES" || id === "my_properties") {
          const { listMyProperties } = await import("./properties/list.ts");
          handled = await listMyProperties(ctx);
        }
        else if (id.startsWith("PROP::")) {
          const propertyId = id.replace("PROP::", "");
          const { handlePropertySelection } = await import("./properties/list.ts");
          handled = await handlePropertySelection(ctx, propertyId);
        }
        else if (id === IDS.CREATE_PROPERTY) {
          const { startCreateProperty } = await import("./properties/create.ts");
          handled = await startCreateProperty(ctx);
        }
        else if (id.startsWith("EDIT_PROP::")) {
          const propertyId = id.replace("EDIT_PROP::", "");
          const { startEditProperty } = await import("./properties/update.ts");
          handled = await startEditProperty(ctx, propertyId);
        }
        else if (id.startsWith("DELETE_PROP::")) {
          const propertyId = id.replace("DELETE_PROP::", "");
          const { confirmDeleteProperty } = await import("./properties/delete.ts");
          handled = await confirmDeleteProperty(ctx, propertyId);
        }
        else if (id.startsWith("CONFIRM_DELETE_PROP::")) {
          const propertyId = id.replace("CONFIRM_DELETE_PROP::", "");
          const { handleDeleteProperty } = await import("./properties/delete.ts");
          handled = await handleDeleteProperty(ctx, propertyId);
        }
        else if (id.startsWith("EDIT_PROP_TITLE::")) {
          const propertyId = id.replace("EDIT_PROP_TITLE::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "title");
        }
        else if (id.startsWith("EDIT_PROP_DESC::")) {
          const propertyId = id.replace("EDIT_PROP_DESC::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "description");
        }
        else if (id.startsWith("EDIT_PROP_LOC::")) {
          const propertyId = id.replace("EDIT_PROP_LOC::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "location");
        }
        else if (id.startsWith("EDIT_PROP_PRICE::")) {
          const propertyId = id.replace("EDIT_PROP_PRICE::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "price");
        }
        else if (id.startsWith("BACK_PROP::")) {
          const propertyId = id.replace("BACK_PROP::", "");
          const { handlePropertySelection } = await import("./properties/list.ts");
          handled = await handlePropertySelection(ctx, propertyId);
        }
        
        // My Vehicles
        else if (id === IDS.MY_VEHICLES || id === "MY_VEHICLES" || id === "my_vehicles") {
          const { listMyVehicles } = await import("./vehicles/list.ts");
          handled = await listMyVehicles(ctx);
        }
        else if (id.startsWith("VEHICLE::")) {
          const vehicleId = id.replace("VEHICLE::", "");
          const { handleVehicleSelection } = await import("./vehicles/list.ts");
          handled = await handleVehicleSelection(ctx, vehicleId);
        }
        
        // Saved Locations
        else if (id === IDS.SAVED_LOCATIONS || id === "SAVED_LOCATIONS" || id === "saved_locations") {
          const { listSavedLocations } = await import("./profile/locations.ts");
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
          const { handleLocationSelection } = await import("./profile/locations.ts");
          handled = await handleLocationSelection(ctx, locationId);
        }
        else if (id.startsWith("ADD_LOC::")) {
          const locationType = id.replace("ADD_LOC::", "");
          if (ctx.profileId) {
            const { setState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
          if (!ctx.profileId || !state || state.key !== "confirm_add_location") {
            handled = false;
          } else {
            const { lat, lng, address } = state.data;
            
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
            
            const { clearState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
              const { setState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
              const { setState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
              const { clearState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
          const { startProfile } = await import("./profile/home.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Wallet Earn
        else if (id === IDS.WALLET_EARN) {
          const { showWalletEarn } = await import("./wallet/earn.ts");
          handled = await showWalletEarn(ctx);
        }
        else if (id === IDS.WALLET_VIEW_BALANCE) {
          const { showWalletBalance } = await import("./wallet/home.ts");
          handled = await showWalletBalance(ctx);
        }

        // Wallet Share - WhatsApp
        else if (id === IDS.WALLET_SHARE_WHATSAPP || id === IDS.WALLET_SHARE_QR || id === IDS.WALLET_SHARE_DONE) {
          const { handleWalletEarnSelection, handleWalletShareDone } = await import("./wallet/earn.ts");
          if (id === IDS.WALLET_SHARE_DONE) {
            handled = await handleWalletShareDone(ctx);
          } else {
            handled = await handleWalletEarnSelection(ctx, state as any, id);
          }
        }
        
        // Wallet Transfer
        else if (id === IDS.WALLET_TRANSFER) {
          const { startWalletTransfer } = await import("./wallet/transfer.ts");
          handled = await startWalletTransfer(ctx);
        }
        
        // Wallet Redeem
        else if (id === IDS.WALLET_REDEEM) {
          const { showWalletRedeem } = await import("./wallet/redeem.ts");
          handled = await showWalletRedeem(ctx);
        }
        
        // Wallet Top (Leaderboard)
        else if (id === IDS.WALLET_TOP) {
          const { showWalletTop } = await import("./wallet/top.ts");
          handled = await showWalletTop(ctx);
        }
        
        // Wallet Transactions
        else if (id === IDS.WALLET_TRANSACTIONS) {
          const { showWalletTransactions } = await import("./wallet/transactions.ts");
          handled = await showWalletTransactions(ctx);
        }
        
        // Wallet Referral
        else if (id === IDS.WALLET_REFERRAL || id === IDS.WALLET_SHARE) {
          const { handleWalletReferral } = await import("./wallet/referral.ts");
          handled = await handleWalletReferral(ctx);
        }
        else if (id.startsWith("partner::") || id === "manual_recipient") {
          const { handleWalletTransferSelection } = await import("./wallet/transfer.ts");
          handled = await handleWalletTransferSelection(ctx, state as any, id);
        }
        else if (id.startsWith("wallet_tx::")) {
          const { showWalletTransactions } = await import("./wallet/transactions.ts");
          handled = await showWalletTransactions(ctx);
        }
        else if (id.startsWith("wallet_top::")) {
          const { showWalletTop } = await import("./wallet/top.ts");
          handled = await showWalletTop(ctx);
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
        
        // Token Purchase
        else if (id === "WALLET_PURCHASE" || id === "buy_tokens") {
          const { handleWalletPurchase } = await import("./wallet/purchase.ts");
          handled = await handleWalletPurchase(ctx);
        }
        else if (id.startsWith("purchase_")) {
          const { handlePurchasePackage } = await import("./wallet/purchase.ts");
          handled = await handlePurchasePackage(ctx, id);
        }
        
        // Cash Out
        else if (id === "WALLET_CASHOUT" || id === "cash_out") {
          const { handleCashOut } = await import("./wallet/cashout.ts");
          handled = await handleCashOut(ctx);
        }
        else if (id === "cashout_confirm_yes") {
          const { handleCashOutConfirm } = await import("./wallet/cashout.ts");
          handled = await handleCashOutConfirm(ctx);
        }
        else if (id === "cashout_confirm_no") {
          const { handleCashOutCancel } = await import("./wallet/cashout.ts");
          handled = await handleCashOutCancel(ctx);
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
        
        // Reward selection
        else if (id.startsWith("REWARD::") && state?.key === IDS.WALLET_REDEEM) {
          const { handleRewardSelection } = await import("./wallet/redeem.ts");
          handled = await handleRewardSelection(ctx, state.data as any, id);
        }
        
      }
    }

    // Handle Text Messages
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      
      // Check for menu selection key first
      if (text === "profile") {
        const { startProfile } = await import("./profile/home.ts");
        handled = await startProfile(ctx, state ?? { key: "home" });
      }
      // Wallet keywords
      else if (text.includes("wallet") || text.includes("balance")) {
        const { startWallet } = await import("./wallet/home.ts");
        handled = await startWallet(ctx, state ?? { key: "home" });
      } else if (text.includes("transfer") || text.includes("send")) {
        const { startWalletTransfer } = await import("./wallet/transfer.ts");
        handled = await startWalletTransfer(ctx);
      } else if (text.includes("redeem") || text.includes("reward")) {
        const { showWalletRedeem } = await import("./wallet/redeem.ts");
        handled = await showWalletRedeem(ctx);
      } else if (text.includes("earn") || text.includes("get token")) {
        const { showWalletEarn } = await import("./wallet/earn.ts");
        handled = await showWalletEarn(ctx);
      } else if (text.includes("share") || text.includes("referral")) {
        const { handleWalletReferral } = await import("./wallet/referral.ts");
        handled = await handleWalletReferral(ctx);
      } else if (text.includes("transaction") || text.includes("history")) {
        const { showWalletTransactions } = await import("./wallet/transactions.ts");
        handled = await showWalletTransactions(ctx);
      }
      
      // Purchase keywords
      else if (["buy", "buy tokens", "purchase", "purchase tokens"].includes(text)) {
        const { handleWalletPurchase } = await import("./wallet/purchase.ts");
        handled = await handleWalletPurchase(ctx);
      }
      
      // Cash-out keywords
      else if (["cash out", "cashout", "withdraw", "withdrawal"].includes(text)) {
        const { handleCashOut } = await import("./wallet/cashout.ts");
        handled = await handleCashOut(ctx);
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

      else if (state?.key === IDS.WALLET_TRANSFER) {
        const { handleWalletTransferText } = await import("./wallet/transfer.ts");
        handled = await handleWalletTransferText(ctx, (message.text as any)?.body ?? "", state as any);
      }
      else if (state?.key === IDS.WALLET_REFERRAL) {
        const { applyReferralCodeFromMessage } = await import("./wallet/referral.ts");
        handled = await applyReferralCodeFromMessage(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle purchase amount input
      else if (state?.key === "wallet_purchase_amount") {
        const { handlePurchaseAmount } = await import("./wallet/purchase.ts");
        handled = await handlePurchaseAmount(ctx, text);
      }
      
      // Handle cash-out amount input
      else if (state?.key === "wallet_cashout_amount") {
        const { handleCashOutAmount } = await import("./wallet/cashout.ts");
        handled = await handleCashOutAmount(ctx, text);
      }
      
      // Handle cash-out phone input
      else if (state?.key === "wallet_cashout_phone") {
        const { handleCashOutPhone } = await import("./wallet/cashout.ts");
        handled = await handleCashOutPhone(ctx, text);
      }
      
      // Handle business creation name
      else if (state?.key === "business_create_name") {
        const { handleCreateBusinessName } = await import("./business/create.ts");
        handled = await handleCreateBusinessName(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle business edit fields
      else if (state?.key === "business_edit_name") {
        const { handleUpdateBusinessField } = await import("./business/update.ts");
        handled = await handleUpdateBusinessField(ctx, state.data.businessId, "name", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "business_edit_description") {
        const { handleUpdateBusinessField } = await import("./business/update.ts");
        handled = await handleUpdateBusinessField(ctx, state.data.businessId, "description", (message.text as any)?.body ?? "");
      }
      
      // Handle job creation title
      else if (state?.key === "job_create_title") {
        const { handleCreateJobTitle } = await import("./jobs/create.ts");
        handled = await handleCreateJobTitle(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle job edit fields
      else if (state?.key === "job_edit_title") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "title", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_description") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "description", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_location") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "location", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_requirements") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "requirements", (message.text as any)?.body ?? "");
      }
      
      // Handle property creation title
      else if (state?.key === "property_create_title") {
        const { handleCreatePropertyTitle } = await import("./properties/create.ts");
        handled = await handleCreatePropertyTitle(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle property edit fields
      else if (state?.key === "property_edit_title") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "title", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_description") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "description", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_location") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "location", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_price") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "price", (message.text as any)?.body ?? "");
      }
      
      // Handle profile edit name
      else if (state?.key === IDS.EDIT_PROFILE_NAME) {
        const { handleEditName } = await import("./profile/edit.ts");
        handled = await handleEditName(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle add location (text address)
      else if (state?.key === IDS.ADD_LOCATION && message.type === "text") {
        if (ctx.profileId && state.data?.type) {
          const address = (message.text as any)?.body ?? "";
          const locationType = state.data.type as string;
          
          // For now, just confirm receipt - actual location saving would need geocoding
          const { clearState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
            const { setState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
          
          const { clearState } = await import("../_shared/wa-webhook-shared/state/store.ts");
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
      service: "wa-webhook-profile",
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
