import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage, sendButtonsMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";
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

  // Fetch profile menu items dynamically from database
  const menuItems = await fetchProfileMenuItems(
    ctx.countryCode || 'RW',
    ctx.locale || 'en',
    ctx.supabase
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
 * Map profile menu item keys to IDS constants
 */
function getProfileMenuItemId(key: string): string {
  const mapping: Record<string, string> = {
    'view_profile': IDS.PROFILE_SETTINGS,
    'momo_qr': IDS.MOMO_QR,
    'payment_history': IDS.PROFILE_TOKENS,
    'settings': IDS.PROFILE_SETTINGS,
    'change_language': 'change_language',
    'help_support': 'help_support',
  };
  return mapping[key] || key;
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

export async function handleVehicleCertificateUpload(
  ctx: RouterContext,
  fileUrl: string,
  vehiclePlate: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "profile.vehicles.add.processing"),
    []
  );

  try {
    // Call vehicle OCR edge function
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/vehicle-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        profile_id: ctx.profileId,
        org_id: "default", // Use default org or fetch from profile
        vehicle_plate: vehiclePlate,
        file_url: fileUrl,
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
    .from("business_owners")
    .select("business_id, businesses(id, name, category)")
    .eq("profile_id", ctx.profileId!);

  return (data || []).map((item: any) => ({
    id: item.businesses.id,
    name: item.businesses.name,
    category: item.businesses.category,
  }));
}
