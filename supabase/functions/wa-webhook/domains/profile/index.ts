import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage, sendButtonsMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { detectCountryIso } from "../../utils/phone.ts";
import { fetchProfileMenuItems, submenuItemsToRows } from "../../utils/dynamic_submenu.ts";

/**
 * Profile Hub
 * Unified entry point for managing:
 * - Vehicles
 * - Businesses
 * - Properties
 * - Tokens
 * - Settings
 */

export async function handleProfileMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("PROFILE_MENU_OPENED", {
    profile_id: ctx.profileId,
    wa_id: ctx.from,
  });

  const countryCode = detectCountryIso(ctx.from)?.toUpperCase() ?? "RW";

  await setState(ctx.supabase, ctx.profileId, {
    key: "profile_menu",
    data: { countryCode },
  });

  // Fetch profile menu items dynamically from database
  const menuItems = await fetchProfileMenuItems(
    countryCode,
    ctx.locale,
    ctx.supabase,
  );

  if (!menuItems || menuItems.length === 0) {
    console.error("No profile menu items found, using fallback");
    // Fallback to basic menu with MOMO QR
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "profile.menu.title"),
        body: t(ctx.locale, "profile.menu.body"),
        sectionTitle: t(ctx.locale, "profile.menu.section"),
        rows: [
          {
            id: IDS.MOMO_QR,
            title: "📱 MOMO QR & Tokens",
            description: "View your MOMO QR code and payment tokens",
          },
          {
            id: IDS.BACK_MENU,
            title: t(ctx.locale, "common.menu_back"),
            description: t(ctx.locale, "common.back_to_menu.description"),
          },
        ],
        buttonText: t(ctx.locale, "common.buttons.open"),
      },
      { emoji: "👤" }
    );
    return true;
  }

  // Convert database items to WhatsApp list rows
  const rows = submenuItemsToRows(menuItems, getProfileMenuItemId);

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "profile.menu.title"),
      body: t(ctx.locale, "profile.menu.body"),
      sectionTitle: t(ctx.locale, "profile.menu.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "👤" }
  );

  return true;
}

/**
 * Map profile menu item action_targets to route IDs
 * This ensures the router can handle actions from database-driven menu
 */
function getProfileMenuItemId(key: string): string {
  // Map database action_targets to router-recognized IDs
  const actionTargetMapping: Record<string, string> = {
    'show_businesses': IDS.PROFILE_BUSINESSES,
    'show_vehicles': IDS.PROFILE_VEHICLES,
    'show_properties': IDS.PROFILE_PROPERTIES,
    'show_my_jobs': IDS.JOB_MY_JOBS,
    'show_momo_qr': IDS.MOMO_QR,
    'show_saved_locations': 'saved_locations',
    'show_help': 'help_support',
    'change_language': 'change_language',
    'show_profile': IDS.PROFILE_VIEW,
    'show_settings': IDS.PROFILE_SETTINGS,
  };
  
  // Also support direct key mapping as fallback
  const keyMapping: Record<string, string> = {
    'my_businesses': IDS.PROFILE_BUSINESSES,
    'my_vehicles': IDS.PROFILE_VEHICLES,
    'my_properties': IDS.PROFILE_PROPERTIES,
    'my_jobs': IDS.JOB_MY_JOBS,
    'momo_qr': IDS.MOMO_QR,
    'saved_locations': 'saved_locations',
    'help_support': 'help_support',
    'change_language': 'change_language',
  };
  
  return actionTargetMapping[key] || keyMapping[key] || key;
}

export async function handleProfileVehicles(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  const vehicles = await getUserVehicles(ctx);

  if (!vehicles.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.vehicles.empty"),
      [
        { id: IDS.PROFILE_ADD_VEHICLE, title: t(ctx.locale, "profile.vehicles.add_button") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ]
    );
    return true;
  }

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "profile.vehicles.list.title"),
      body: t(ctx.locale, "profile.vehicles.list.body"),
      sectionTitle: t(ctx.locale, "profile.vehicles.list.section"),
      rows: [
        ...vehicles.map((v) => ({
          id: `VEH::${v.id}`,
          title: `${v.plate} ${v.status === "active" ? "✓" : "⏳"}`,
          description: `${v.make || ""} ${v.model || ""} ${v.year || ""}`.trim() || t(ctx.locale, "profile.vehicles.no_details"),
        })),
        {
          id: IDS.PROFILE_ADD_VEHICLE,
          title: t(ctx.locale, "profile.vehicles.add_button"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "🚗" }
  );

  return true;
}

export async function handleAddVehicle(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "profile_add_vehicle",
    data: { stage: "upload_certificate" },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "profile.vehicles.add.upload_prompt"),
    [
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.buttons.skip") },
    ]
  );

  return true;
}

/**
 * Handle vehicle certificate media upload
 */
export async function handleVehicleCertificateMedia(
  ctx: RouterContext,
  msg: any
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Extract media ID and download URL
  const mediaId = msg.image?.id;
  if (!mediaId) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.vehicles.add.invalid_image"),
      homeOnly()
    );
    return true;
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "profile.vehicles.add.processing"),
    []
  );

  try {
    // Get media URL from WhatsApp
    const mediaUrl = await getMediaUrl(mediaId);
    
    // For now, we'll generate a simple vehicle plate from timestamp
    // In production, you'd extract this from OCR or ask the user
    const vehiclePlate = `VEH-${Date.now().toString().slice(-6)}`;

    // Call vehicle OCR edge function
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/vehicle-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        profile_id: ctx.profileId,
        org_id: "default",
        vehicle_plate: vehiclePlate,
        file_url: mediaUrl,
      }),
    });

    const result = await response.json();

    if (result.success && result.status === "active") {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "profile.vehicles.add.success", { plate: vehiclePlate }),
        homeOnly()
      );
    } else {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "profile.vehicles.add.pending", { 
          plate: vehiclePlate,
          reason: result.reason || "verification_needed"
        }),
        homeOnly()
      );
    }

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    console.error("Vehicle certificate upload error:", error);
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.vehicles.add.error"),
      homeOnly()
    );

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }
}

async function getMediaUrl(mediaId: string): Promise<string> {
  // Get WhatsApp access token
  const accessToken = Deno.env.get("WA_ACCESS_TOKEN");
  
  // Fetch media URL from WhatsApp API
  const response = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  
  const data = await response.json();
  return data.url || "";
}

export async function handleProfileBusinesses(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  const businesses = await getUserBusinesses(ctx);

  if (!businesses.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.businesses.empty"),
      [
        { id: IDS.PROFILE_ADD_BUSINESS, title: t(ctx.locale, "profile.businesses.add_button") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ]
    );
    return true;
  }

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "profile.businesses.list.title"),
      body: t(ctx.locale, "profile.businesses.list.body"),
      sectionTitle: t(ctx.locale, "profile.businesses.list.section"),
      rows: [
        ...businesses.map((b) => ({
          id: `BIZ::${b.id}`,
          title: b.name,
          description: b.category || t(ctx.locale, "profile.businesses.no_category"),
        })),
        {
          id: IDS.PROFILE_ADD_BUSINESS,
          title: t(ctx.locale, "profile.businesses.add_button"),
        },
        {
          id: IDS.PROFILE_MANAGE_WHATSAPP_NUMBERS,
          title: t(ctx.locale, "profile.businesses.manage_numbers"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "🏢" }
  );

  return true;
}

export async function handleAddBusiness(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Start the business claiming flow with smart search
  const { startBusinessClaim } = await import("../business/claim.ts");
  return await startBusinessClaim(ctx);
}

// Helper functions

async function getProfileAssetCounts(ctx: RouterContext): Promise<{
  vehicles: number;
  businesses: number;
  properties: number;
}> {
  const { data: assets } = await ctx.supabase
    .from("profile_assets")
    .select("kind")
    .eq("profile_id", ctx.profileId!);

  const counts = {
    vehicles: 0,
    businesses: 0,
    properties: 0,
  };

  if (assets) {
    for (const asset of assets) {
      if (asset.kind === "vehicle") counts.vehicles++;
      else if (asset.kind === "business") counts.businesses++;
      else if (asset.kind === "property") counts.properties++;
    }
  }

  return counts;
}

async function getUserVehicles(ctx: RouterContext) {
  const { data } = await ctx.supabase
    .from("vehicles")
    .select("id, plate, make, model, year, status")
    .eq("profile_id", ctx.profileId!)
    .order("created_at", { ascending: false });

  return data || [];
}

async function getUserBusinesses(ctx: RouterContext) {
  const { data } = await ctx.supabase
    .from("business")
    .select("id, name, category_name")
    .eq("owner_user_id", ctx.profileId!);

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    category: item.category_name,
  }));
}
