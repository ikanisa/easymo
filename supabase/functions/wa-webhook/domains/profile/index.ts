import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage, sendButtonsMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { detectCountryIso } from "../../utils/phone.ts";
import { fetchInsuranceMedia, uploadInsuranceBytes } from "../insurance/ins_media.ts";
import { runInsuranceOCR } from "../insurance/ins_ocr.ts";
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

  // Load current pagination state (default page 0)
  let page = 0;
  try {
    const { data } = await ctx.supabase
      .from("chat_state")
      .select("data")
      .eq("user_id", ctx.profileId)
      .eq("key", "profile_menu")
      .maybeSingle();
    if (data?.data?.page && Number.isFinite(Number(data.data.page))) {
      page = Math.max(0, Number(data.data.page));
    }
  } catch (_) {
    // ignore and use default
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "profile_menu",
    data: { countryCode, page },
  });

  // Fetch profile menu items dynamically from database
  const menuItems = await fetchProfileMenuItems(
    countryCode,
    ctx.locale,
    ctx.supabase,
  );

  if (!menuItems || menuItems.length === 0) {
    console.error("No profile menu items found, using fallback");
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "profile.menu.title"),
        body: t(ctx.locale, "profile.menu.body"),
        sectionTitle: t(ctx.locale, "profile.menu.section"),
        rows: [
          {
            id: IDS.MOMO_QR,
            title: t(ctx.locale, "profile.menu.momoQr.title"),
            description: t(ctx.locale, "profile.menu.momoQr.description"),
          },
          {
            id: IDS.WALLET,
            title: t(ctx.locale, "profile.menu.wallet.title"),
            description: t(ctx.locale, "profile.menu.wallet.description"),
          },
          {
            id: IDS.BACK_MENU,
            title: t(ctx.locale, "common.menu_back"),
            description: t(ctx.locale, "common.back_to_menu.description"),
          },
        ],
        buttonText: t(ctx.locale, "common.buttons.open"),
      },
      { emoji: "👤" },
    );
    return true;
  }

  // Convert database items to WhatsApp list rows with pagination support
  const allRows = submenuItemsToRows(menuItems, getProfileMenuItemId);
  const total = allRows.length;
  // Compute reserved control rows based on current page
  const computePageSize = (pageIdx: number, totalItems: number) => {
    const baseMax = 10; // WhatsApp hard limit per section
    const totalPages = Math.max(1, Math.ceil(totalItems / 9));
    const hasPrev = pageIdx > 0;
    const hasNext = pageIdx < totalPages - 1;
    const reserved = 1 + (hasPrev ? 1 : 0) + (hasNext ? 1 : 0); // Back + Prev/Next
    return Math.max(0, baseMax - reserved);
  };
  // Re-evaluate total pages after computing page size dynamics
  const initialPageSize = computePageSize(page, total);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, initialPageSize)));
  if (page >= totalPages) page = totalPages - 1;
  const pageSize = computePageSize(page, total);
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = allRows.slice(start, end);

  // Add pagination controls if needed
  if (totalPages > 1) {
    if (page > 0) {
      pageRows.unshift({
        id: IDS.PROFILE_PREV,
        title: "◀ Prev",
        description: `Page ${page + 1} of ${totalPages}`,
      });
    }
    if (page < totalPages - 1 && pageRows.length < pageSize) {
      pageRows.push({
        id: IDS.PROFILE_NEXT,
        title: "Next ▶",
        description: `Page ${page + 1} of ${totalPages}`,
      });
    }
  }

  // Add back button (last slot)
  pageRows.push({
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
      rows: pageRows,
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
    'show_wallet': IDS.WALLET,
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
    'wallet_tokens': IDS.WALLET,
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
        ...(vehicles.length ? vehicles.map((v) => ({
          id: `VEH-DEL::${v.id}`,
          title: `🗑️ Delete ${v.plate}`,
          description: t(ctx.locale, "profile.vehicles.delete_confirm_short"),
        })) : []),
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
  const mediaId = msg.image?.id || msg.document?.id;
  if (!mediaId) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.vehicles.add.invalid_image"),
      homeOnly()
    );
    return true;
  }

  await sendButtonsMessage(ctx, t(ctx.locale, "profile.vehicles.add.processing"), []);

  try {
    // Fetch and upload media to storage, get signed URL for OCR
    const media = await fetchInsuranceMedia(mediaId, ctx.profileId);
    const uploaded = await uploadInsuranceBytes(ctx.supabase, ctx.profileId, media);
    const ocr = await runInsuranceOCR(uploaded.signedUrl);

    // Validate that this looks like a legit insurance certificate
    const plate = String((ocr as any)?.registration_plate || '').trim();
    const insurer = String((ocr as any)?.insurer_name || '').trim();
    const policy = String((ocr as any)?.policy_number || '').trim();
    const cert = String((ocr as any)?.certificate_number || '').trim();
    const inception = String((ocr as any)?.policy_inception || '').trim();
    const expiry = String((ocr as any)?.policy_expiry || '').trim();

    // Additional validation: expiry must be in the future (>= today)
    const requiredOk = plate && insurer && policy && cert && inception && expiry && (new Date(expiry) >= new Date(new Date().toISOString().slice(0,10)));
    if (!requiredOk) {
      await sendButtonsMessage(
        ctx,
        "❌ This does not look like a valid insurance certificate. Please send a clear photo/PDF of your active insurance certificate.",
        homeOnly()
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }

    // Insert into vehicles
    const insertPayload: any = {
      owner_user_id: ctx.profileId,
      registration_plate: plate,
      insurer_name: insurer,
      policy_number: policy,
      certificate_number: cert,
      policy_inception: inception,
      policy_expiry: expiry,
      carte_jaune_number: (ocr as any)?.carte_jaune_number ?? null,
      carte_jaune_expiry: (ocr as any)?.carte_jaune_expiry ?? null,
      make: (ocr as any)?.make ?? null,
      model: (ocr as any)?.model ?? null,
      vehicle_year: (ocr as any)?.vehicle_year ?? null,
      vin_chassis: (ocr as any)?.vin_chassis ?? null,
      usage: (ocr as any)?.usage ?? null,
      licensed_to_carry: (ocr as any)?.licensed_to_carry ?? null,
      document_path: uploaded.path,
      status: 'active',
    };

    await ctx.supabase.from('vehicles').insert(insertPayload);

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "profile.vehicles.add.success", { plate }),
      homeOnly()
    );

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
          id: IDS.PROFILE_MANAGE_BUSINESSES,
          title: "Manage my businesses",
        },
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
    .select("id, registration_plate, make, model, vehicle_year, status")
    .eq("owner_user_id", ctx.profileId!)
    .order("created_at", { ascending: false });

  return (data || []).map((r: any) => ({
    id: r.id,
    plate: r.registration_plate,
    make: r.make,
    model: r.model,
    year: r.vehicle_year,
    status: r.status,
  }));
}

export async function handleVehicleItemSelection(
  ctx: RouterContext,
  vehicleId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const { data: v } = await ctx.supabase
    .from('vehicles')
    .select('id, registration_plate, make, model, vehicle_year, status')
    .eq('id', vehicleId)
    .maybeSingle();
  if (!v) return false;

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "profile.vehicles.list.title"),
      body: `${v.registration_plate} — ${[v.make, v.model, v.vehicle_year].filter(Boolean).join(' ')}`,
      sectionTitle: t(ctx.locale, "profile.vehicles.list.section"),
      rows: [
        {
          id: `VEH-DEL::${v.id}`,
          title: `🗑️ ${t(ctx.locale, "profile.vehicles.delete_confirm_short")}`,
          description: t(ctx.locale, "profile.vehicles.no_details"),
        },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ],
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: '🚗' },
  );
  return true;
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
